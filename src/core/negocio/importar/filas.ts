import { centavos, MAX_CENTAVOS, MAX_MILESIMAS, milesimas } from '../numeros';
import { detectarConvencion, leerEscalado } from './numero';
import { normalizarCodigo, normalizarNombre } from './texto';
import {
  ErrorImportacion,
  LIMITES,
  type Centavos,
  type Convencion,
  type ErrorFila,
  type FilaImportable,
  type MapeoColumnas,
  type Tabla,
} from './tipos';

export interface OpcionesFilas {
  /** Fila de encabezados (desde 0); los datos empiezan en la siguiente. Por defecto 0. */
  filaEncabezado?: number;
  /** Fuerza la convención de números; si no, se deduce del archivo (ver `ResultadoFilas.convencion`). */
  convencion?: Convencion;
}

export interface ResultadoFilas {
  filas: FilaImportable[];
  /** Filas rechazadas o ignoradas (repetidas), con el motivo para mostrar. */
  errores: ErrorFila[];
  /**
   * Convención con la que se leyeron los números ambiguos («1.500»): la indicada, la que
   * delatan los demás números del archivo o, sin pistas, `es-CO` (la app es para Colombia).
   */
  convencion: Convencion;
}

/** «Total», «Totales», «Subtotal», «Gran total», «Total general»… */
const TOTAL = /^(sub ?)?total(es)?\b|^gran total\b|^suma total\b/;

/**
 * Convierte la tabla en filas listas para importar. Salta filas vacías, de totales y encabezados
 * repetidos; recorta nombres a 120 caracteres; descarta repetidos por nombre normalizado o por
 * código (avisa en `errores`); cantidades a milésimas y dinero a centavos, enteros.
 * Lanza `ErrorImportacion` si el mapeo no dice dónde están el nombre y la cantidad.
 */
export function filasImportables(tabla: Tabla, mapeo: MapeoColumnas, opciones: OpcionesFilas = {}): ResultadoFilas {
  const { nombre: colNombre, cantidad: colCantidad } = mapeo;
  if (colNombre === undefined) throw new ErrorImportacion('Elige qué columna tiene el nombre del producto.');
  if (colCantidad === undefined) throw new ErrorImportacion('Elige qué columna tiene la cantidad (existencia final).');
  for (const [campo, col] of Object.entries(mapeo)) {
    if (!Number.isInteger(col) || col < 0 || col >= LIMITES.columnas) {
      throw new ErrorImportacion(`La columna elegida para «${campo}» no existe.`);
    }
  }
  const filaEncabezado = opciones.filaEncabezado ?? 0;
  const encabezado = tabla[filaEncabezado] ?? [];
  const datos = tabla.slice(filaEncabezado + 1);

  const numericas = [mapeo.cantidad, mapeo.precio, mapeo.costo].filter((c): c is number => c !== undefined);
  const convencion =
    opciones.convencion ?? detectarConvencion(datos.flatMap((f) => numericas.map((c) => f[c] ?? ''))) ?? 'es-CO';

  const filas: FilaImportable[] = [];
  const errores: ErrorFila[] = [];
  const porNombre = new Map<string, number>();
  const porCodigo = new Map<string, number>();
  const celda = (f: readonly string[], col: number | undefined): string => (col === undefined ? '' : (f[col] ?? ''));

  datos.forEach((f, i) => {
    const filaOriginal = filaEncabezado + i + 2;
    const error = (motivo: string) => errores.push({ fila: filaOriginal, motivo });
    if (f.every((c) => c === '')) return;

    let nombre = celda(f, colNombre);
    const clave = normalizarNombre(nombre);
    if (TOTAL.test(clave) || (clave === '' && f.some((c) => TOTAL.test(normalizarNombre(c))))) return;
    // Encabezado repetido (reportes paginados)
    if (clave !== '' && clave === normalizarNombre(encabezado[colNombre] ?? '')) return;
    if (clave === '') return void error('Sin nombre de producto.');
    if (nombre.length > LIMITES.caracteresNombre) {
      nombre = Array.from(nombre).slice(0, LIMITES.caracteresNombre).join('').trim();
    }

    const textoCantidad = celda(f, colCantidad);
    if (textoCantidad === '') return void error(`«${nombre}»: sin cantidad.`);
    const leida = leerEscalado(textoCantidad, 3, convencion);
    if (leida === null) return void error(`«${nombre}»: la cantidad «${textoCantidad}» no es un número válido.`);
    // Se aceptan negativos (el sistema anterior pudo vender sin existencia), pero no absurdos
    if (Math.abs(leida) > MAX_MILESIMAS) return void error(`«${nombre}»: la cantidad «${textoCantidad}» es demasiado grande.`);
    const cantidad = milesimas(leida);

    const dinero = (campo: 'precio' | 'costo'): Centavos | undefined | false => {
      const bruto = celda(f, mapeo[campo]);
      if (bruto === '') return undefined;
      const valor = leerEscalado(bruto, 2, convencion);
      if (valor === null || valor < 0 || valor > MAX_CENTAVOS) {
        error(`«${nombre}»: el ${campo} «${bruto}» no es un valor válido.`);
        return false;
      }
      return centavos(valor);
    };
    const precio = dinero('precio');
    if (precio === false) return;
    const costo = dinero('costo');
    if (costo === false) return;

    const previa = porNombre.get(clave);
    if (previa !== undefined) {
      return void error(`«${nombre}» está repetido (ya está en la fila ${previa}); se ignora esta fila.`);
    }
    const codigo = texto(celda(f, mapeo.codigo));
    if (codigo !== undefined) {
      const previaCodigo = porCodigo.get(normalizarCodigo(codigo));
      if (previaCodigo !== undefined) {
        return void error(`El código «${codigo}» está repetido (ya está en la fila ${previaCodigo}); se ignora esta fila.`);
      }
      porCodigo.set(normalizarCodigo(codigo), filaOriginal);
    }
    porNombre.set(clave, filaOriginal);

    const fila: FilaImportable = { nombre, cantidad, filaOriginal };
    if (precio !== undefined) fila.precio = precio;
    if (costo !== undefined) fila.costo = costo;
    const categoria = texto(celda(f, mapeo.categoria));
    if (categoria !== undefined) fila.categoria = categoria;
    if (codigo !== undefined) fila.codigo = codigo;
    const unidad = texto(celda(f, mapeo.unidad));
    if (unidad !== undefined) fila.unidad = unidad;
    filas.push(fila);
  });

  return { filas, errores, convencion };
}

/** Texto opcional recortado a LIMITES.caracteresCampo; undefined si está vacío. */
function texto(valor: string): string | undefined {
  if (valor === '') return undefined;
  return valor.length > LIMITES.caracteresCampo
    ? Array.from(valor).slice(0, LIMITES.caracteresCampo).join('').trim()
    : valor;
}
