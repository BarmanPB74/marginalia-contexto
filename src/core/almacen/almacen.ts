/**
 * Almacenamiento de archivos de texto de la app.
 *
 * Dos capas:
 * - `Disco`: operaciones crudas de la plataforma, sin garantías (Capacitor en el teléfono,
 *   memoria en pruebas y en el navegador).
 * - `Almacen`: lo que usa el resto de la app. Añade validación de rutas, escritura atómica
 *   (temporal + renombrar), recuperación tras un corte y una cola por archivo.
 */

export interface Disco {
  /** Contenido del archivo, o `null` si no existe. */
  leer(ruta: string): Promise<string | null>;
  /** Crea o reemplaza el archivo (y sus carpetas). No es atómico. */
  escribir(ruta: string, contenido: string): Promise<void>;
  /** Mueve `origen` a `destino`, reemplazándolo si existe. */
  renombrar(origen: string, destino: string): Promise<void>;
  /** Borra el archivo; no falla si no existe. */
  borrar(ruta: string): Promise<void>;
  /** Nombres de los archivos de la carpeta (sin subcarpetas); `[]` si no existe. */
  listar(carpeta: string): Promise<string[]>;
}

export interface Almacen {
  leer(ruta: string): Promise<string | null>;
  escribir(ruta: string, contenido: string): Promise<void>;
  borrar(ruta: string): Promise<void>;
  /** Nombres de archivo de la carpeta, ordenados. Nunca incluye temporales. */
  listar(carpeta: string): Promise<string[]>;
}

export class RutaInvalida extends Error {
  constructor(ruta: string) {
    super(`Ruta no permitida: ${JSON.stringify(ruta)}`);
    this.name = 'RutaInvalida';
  }
}

const TEMPORAL = '.tmp';
// Cada tramo empieza por letra o dígito: así no hay "..", ni ocultos, ni rutas absolutas.
const TRAMO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function validar(ruta: string, esCarpeta = false): string {
  const tramos = ruta.split('/');
  const valida =
    ruta.length > 0 && tramos.every((t) => TRAMO.test(t)) && (esCarpeta || !ruta.endsWith(TEMPORAL));
  if (!valida) throw new RutaInvalida(ruta);
  return ruta;
}

export function crearAlmacen(disco: Disco): Almacen {
  // Última operación pendiente de cada ruta: las escrituras de un mismo archivo van en fila.
  const colas = new Map<string, Promise<unknown>>();

  function enFila<T>(ruta: string, tarea: () => Promise<T>): Promise<T> {
    const anterior = colas.get(ruta) ?? Promise.resolve();
    const actual = anterior.catch(() => undefined).then(tarea);
    colas.set(ruta, actual);
    // Limpiar la entrada cuando nadie más espera detrás.
    void actual.catch(() => undefined).then(() => {
      if (colas.get(ruta) === actual) colas.delete(ruta);
    });
    return actual;
  }

  return {
    async leer(ruta) {
      validar(ruta);
      return enFila(ruta, async () => {
        const contenido = await disco.leer(ruta);
        if (contenido !== null) return contenido;
        // En Android `renombrar` borra el destino antes de mover: si se cortó justo ahí,
        // el temporal está completo (se escribió entero antes de renombrar).
        const huerfano = await disco.leer(ruta + TEMPORAL);
        if (huerfano === null) return null;
        await disco.renombrar(ruta + TEMPORAL, ruta);
        return huerfano;
      });
    },

    async escribir(ruta, contenido) {
      validar(ruta);
      return enFila(ruta, async () => {
        await disco.escribir(ruta + TEMPORAL, contenido);
        await disco.renombrar(ruta + TEMPORAL, ruta);
      });
    },

    async borrar(ruta) {
      validar(ruta);
      return enFila(ruta, async () => {
        await disco.borrar(ruta);
        await disco.borrar(ruta + TEMPORAL);
      });
    },

    async listar(carpeta) {
      validar(carpeta, true);
      const nombres = await disco.listar(carpeta);
      const finales = new Set(nombres.filter((n) => !n.endsWith(TEMPORAL)));
      for (const temporal of nombres.filter((n) => n.endsWith(TEMPORAL))) {
        const nombre = temporal.slice(0, -TEMPORAL.length);
        const ruta = `${carpeta}/${nombre}`;
        await enFila(ruta, async () => {
          if (finales.has(nombre)) {
            // El archivo bueno sigue ahí: el temporal es un guardado a medias.
            await disco.borrar(ruta + TEMPORAL);
          } else if (TRAMO.test(nombre)) {
            await disco.renombrar(ruta + TEMPORAL, ruta);
            finales.add(nombre);
          }
        });
      }
      return [...finales].sort();
    },
  };
}

/** Disco en memoria: pruebas y navegador. */
export class DiscoMemoria implements Disco {
  private readonly archivos = new Map<string, string>();

  async leer(ruta: string) {
    return this.archivos.get(ruta) ?? null;
  }

  async escribir(ruta: string, contenido: string) {
    this.archivos.set(ruta, contenido);
  }

  async renombrar(origen: string, destino: string) {
    const contenido = this.archivos.get(origen);
    if (contenido === undefined) throw new Error(`No existe ${origen}`);
    this.archivos.delete(origen);
    this.archivos.set(destino, contenido);
  }

  async borrar(ruta: string) {
    this.archivos.delete(ruta);
  }

  async listar(carpeta: string) {
    const prefijo = `${carpeta}/`;
    return [...this.archivos.keys()]
      .filter((r) => r.startsWith(prefijo) && !r.slice(prefijo.length).includes('/'))
      .map((r) => r.slice(prefijo.length));
  }
}
