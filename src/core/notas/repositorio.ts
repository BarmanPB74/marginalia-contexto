import type { Almacen } from '../almacen/almacen';
import { esDiaValido } from './fechas';
import { escribirNota, isoConOffset, leerNota, NotaInvalida, TAMANO_MAXIMO, type Nota } from './nota';
import { aplicarPlantilla, buscarPlantilla } from './plantillas';
import { esUlid, ulid } from './ulid';

const CARPETA = 'notas';
const ruta = (id: string) => `${CARPETA}/${id}.md`;

export interface OpcionesCrear {
  titulo?: string;
  padre?: string;
  /** id de una plantilla de `PLANTILLAS`; por defecto, en blanco. */
  plantilla?: string;
  /**
   * Día del calendario al que pertenece ("AAAA-MM-DD"). Se guarda en `fecha:` y las variables
   * `{{fecha}}` de la plantilla usan ese día (con la hora de ahora).
   */
  dia?: string;
}

/** Notas guardadas como `notas/<id>.md`. El archivo es la fuente de verdad. */
export class RepositorioNotas {
  /** Creadas en esta sesión y aún sin abrir ni guardar: se abren para escribir. */
  private readonly recienCreadas = new Set<string>();

  constructor(
    private readonly almacen: Almacen,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async crear(opciones: OpcionesCrear = {}): Promise<Nota> {
    const plantilla = buscarPlantilla(opciones.plantilla ?? 'en-blanco');
    if (!plantilla) throw new Error(`No existe la plantilla ${JSON.stringify(opciones.plantilla)}`);
    if (opciones.padre !== undefined && !(await this.obtener(opciones.padre))) {
      throw new Error('La página padre no existe');
    }
    if (opciones.dia !== undefined && !esDiaValido(opciones.dia)) throw new Error('El día no es válido');
    const ahora = this.reloj();
    const enDia = opciones.dia ? diaConHora(opciones.dia, ahora) : ahora;
    const titulo = opciones.titulo?.trim() || aplicarPlantilla(plantilla.titulo, { titulo: '', ahora: enDia });
    const fecha = isoConOffset(ahora);
    const nota: Nota = {
      id: ulid(ahora.getTime()),
      titulo,
      creado: fecha,
      editado: fecha,
      etiquetas: [...plantilla.etiquetas],
      ...(opciones.padre ? { padre: opciones.padre } : {}),
      extra: opciones.dia ? { fecha: opciones.dia } : {},
      cuerpo: aplicarPlantilla(plantilla.cuerpo, { titulo, ahora: enDia }),
    };
    await this.escribir(nota);
    this.recienCreadas.add(nota.id);
    return nota;
  }

  /**
   * ¿Se acaba de crear (y nadie la ha abierto aún)? Responde una sola vez por nota.
   * Antes se comparaba `creado === editado`, pero van al segundo: crear, escribir y guardar
   * en el mismo segundo la dejaba "recién creada" para siempre.
   */
  tomarRecienCreada(id: string): boolean {
    return this.recienCreadas.delete(id);
  }

  async obtener(id: string): Promise<Nota | null> {
    if (!esUlid(id)) return null;
    const texto = await this.almacen.leer(ruta(id));
    if (texto === null) return null;
    const nota = leerNota(texto);
    return nota.id === id ? nota : null;
  }

  /** Guarda los cambios y marca la hora de edición. */
  async guardar(nota: Nota): Promise<Nota> {
    const guardada = { ...nota, editado: isoConOffset(this.reloj()) };
    this.recienCreadas.delete(nota.id);
    await this.escribir(guardada);
    return guardada;
  }

  /** Todas las notas legibles; los archivos que no lo son se informan en `danadas`. */
  async listar(): Promise<{ notas: Nota[]; danadas: string[] }> {
    const notas: Nota[] = [];
    const danadas: string[] = [];
    for (const nombre of await this.almacen.listar(CARPETA)) {
      if (!nombre.endsWith('.md')) continue;
      try {
        const nota = leerNota((await this.almacen.leer(`${CARPETA}/${nombre}`)) ?? '');
        // Un archivo copiado con otro nombre trae un id que no es el suyo.
        if (`${nota.id}.md` !== nombre) throw new NotaInvalida('el id no coincide con el archivo');
        notas.push(nota);
      } catch {
        danadas.push(nombre);
      }
    }
    return { notas, danadas };
  }

  /** Borra la nota; sus hijas pasan a la página madre de la borrada (o a la raíz). */
  async borrar(id: string): Promise<void> {
    const nota = await this.obtener(id);
    if (!nota) return;
    const { notas } = await this.listar();
    for (const hija of notas.filter((n) => n.padre === id)) {
      await this.escribir(conPadre(hija, nota.padre));
    }
    await this.almacen.borrar(ruta(id));
  }

  /** Cambia la página madre (`undefined` = raíz). Rechaza ciclos. */
  async mover(id: string, nuevoPadre: string | undefined): Promise<Nota> {
    const nota = await this.obtener(id);
    if (!nota) throw new Error('La nota no existe');
    if (nuevoPadre !== undefined) {
      const { notas } = await this.listar();
      const porId = new Map(notas.map((n) => [n.id, n]));
      if (!porId.has(nuevoPadre)) throw new Error('La página padre no existe');
      const vistos = new Set<string>();
      for (let actual: string | undefined = nuevoPadre; actual; actual = porId.get(actual)?.padre) {
        if (actual === id) throw new Error('Moverla ahí crearía un ciclo');
        if (vistos.has(actual)) break;
        vistos.add(actual);
      }
    }
    return this.guardar(conPadre(nota, nuevoPadre));
  }

  private async escribir(nota: Nota): Promise<void> {
    if (!esUlid(nota.id)) throw new NotaInvalida('id no es ULID');
    const texto = escribirNota(nota);
    // Si se guardara más grande, luego no se podría leer.
    if (new TextEncoder().encode(texto).length > TAMANO_MAXIMO) throw new NotaInvalida('supera 2 MB');
    await this.almacen.escribir(ruta(nota.id), texto);
  }
}

/** El día elegido con la hora del reloj (para `{{hora}}`). */
function diaConHora(dia: string, ahora: Date): Date {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(a, m - 1, d, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds());
}

function conPadre(nota: Nota, padre: string | undefined): Nota {
  const copia: Nota = { ...nota };
  delete copia.padre;
  return padre ? { ...copia, padre } : copia;
}

export interface NodoArbol {
  nota: Nota;
  hijas: NodoArbol[];
}

/**
 * Árbol de páginas. Una nota cuyo padre no existe va a la raíz; si los archivos
 * traen un ciclo (A→B→A), se corta en un punto fijo para que cada nota salga una vez.
 */
export function arbol(notas: readonly Nota[]): NodoArbol[] {
  const porId = new Map(notas.map((n) => [n.id, n]));
  const padreDe = new Map<string, string | undefined>();

  for (const inicio of [...notas].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const camino: Nota[] = [];
    const enCamino = new Set<string>();
    let actual: Nota | undefined = inicio;
    while (actual && !padreDe.has(actual.id)) {
      camino.push(actual);
      enCamino.add(actual.id);
      const padre: string | undefined = actual.padre;
      if (!padre || !porId.has(padre) || enCamino.has(padre)) {
        padreDe.set(actual.id, undefined);
        break;
      }
      actual = porId.get(padre);
    }
    for (const n of camino) if (!padreDe.has(n.id)) padreDe.set(n.id, n.padre);
  }

  const nodos = new Map(notas.map((n) => [n.id, { nota: n, hijas: [] as NodoArbol[] }]));
  const raices: NodoArbol[] = [];
  for (const nodo of nodos.values()) {
    const padre = padreDe.get(nodo.nota.id);
    (padre ? nodos.get(padre)?.hijas : raices)?.push(nodo);
  }
  const ordenar = (lista: NodoArbol[]) => {
    lista.sort((a, b) => a.nota.titulo.localeCompare(b.nota.titulo, 'es'));
    lista.forEach((n) => ordenar(n.hijas));
  };
  ordenar(raices);
  return raices;
}
