import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Almacen } from '../almacen/almacen';
import { CARPETA_DIARIO, Diario, RUTA_INSTANTANEA } from './diario';

/**
 * Copia completa del negocio (protección de datos): diario de eventos, instantánea y adjuntos en
 * un ZIP. Dentro del teléfono todo va cifrado; la copia sale **legible** (JSON) para que nunca
 * quede atrapada en la app, igual que la copia de notas (ADR-002/008): hay que guardarla bien.
 *
 * Restaurar solo se permite en un negocio vacío (primer uso, teléfono nuevo): mezclar dos diarios
 * rompería la cadena de hashes. Antes de aceptarla se verifica la cadena completa; si no cuadra,
 * no queda nada escrito.
 */
export const CARPETA_ADJUNTOS = 'negocio/adjuntos';
const MAX_COPIA = 300 * 1024 * 1024;
const MAX_ARCHIVOS = 20_000;

const LEEME = `Copia del negocio de Bar Box
============================

negocio/diario/AAAA-MM-DD.json  movimientos de cada día (ventas, caja, inventario,
                                compras, pagos, gastos, usuarios), encadenados con huellas
negocio/instantanea.json        estado al último cierre de caja (para abrir rápido)
negocio/adjuntos/*.json         fotos y PDF de facturas y gastos (en base64)

La copia NO está cifrada: guárdala en un lugar seguro.
Para recuperarla en un teléfono nuevo: primer uso → «Restaurar una copia».
`;

/** Rutas que puede traer una copia. Cualquier otra cosa delata un archivo manipulado. */
const RUTA_VALIDA =
  /^negocio\/(diario\/\d{4}-\d{2}-\d{2}\.json|instantanea\.json|adjuntos\/[0-9A-HJKMNP-TV-Z]{26}\.json)$/;

export class CopiaInvalida extends Error {
  constructor(motivo: string) {
    super(`Copia no válida: ${motivo}`);
    this.name = 'CopiaInvalida';
  }
}

export async function crearCopiaNegocio(almacen: Almacen): Promise<Uint8Array> {
  const archivos: Record<string, Uint8Array> = { 'LEEME.txt': strToU8(LEEME) };
  for (const carpeta of [CARPETA_DIARIO, CARPETA_ADJUNTOS]) {
    for (const nombre of await almacen.listar(carpeta)) {
      const ruta = `${carpeta}/${nombre}`;
      const contenido = await almacen.leer(ruta);
      if (contenido !== null && RUTA_VALIDA.test(ruta)) archivos[ruta] = strToU8(contenido);
    }
  }
  const instantanea = await almacen.leer(RUTA_INSTANTANEA);
  if (instantanea !== null) archivos[RUTA_INSTANTANEA] = strToU8(instantanea);
  // Fecha fija: la misma copia da los mismos bytes y no revela la hora local
  return zipSync(archivos, { level: 6, mtime: new Date(Date.UTC(2026, 0, 1)) });
}

/** ¿Ya hay movimientos? Entonces no se restaura encima. */
export async function negocioVacio(almacen: Almacen): Promise<boolean> {
  return (await almacen.listar(CARPETA_DIARIO)).length === 0;
}

/** Restaura una copia en un negocio vacío. Devuelve cuántos movimientos trae. */
export async function restaurarCopiaNegocio(almacen: Almacen, bytes: Uint8Array): Promise<number> {
  if (bytes.length > MAX_COPIA) throw new CopiaInvalida('supera 300 MB');
  if (!(await negocioVacio(almacen))) {
    throw new CopiaInvalida('este teléfono ya tiene movimientos. Solo se restaura en un negocio nuevo.');
  }
  let entradas = 0;
  let contenido: Record<string, Uint8Array>;
  try {
    contenido = unzipSync(bytes, {
      filter: (f) => {
        if (++entradas > MAX_ARCHIVOS) throw new CopiaInvalida('demasiados archivos');
        return RUTA_VALIDA.test(f.name);
      },
    });
  } catch (e) {
    if (e instanceof CopiaInvalida) throw e;
    throw new CopiaInvalida('no se pudo leer (¿está dañada o no es una copia de Bar Box?)');
  }
  const rutas = Object.keys(contenido);
  if (!rutas.some((r) => r.startsWith(`${CARPETA_DIARIO}/`))) throw new CopiaInvalida('no trae movimientos');

  const escritas: string[] = [];
  try {
    for (const ruta of rutas.sort()) {
      const datos = contenido[ruta];
      if (!datos) continue;
      await almacen.escribir(ruta, strFromU8(datos));
      escritas.push(ruta);
    }
    // La cadena completa debe cuadrar antes de aceptar la copia
    const verificacion = await new Diario(almacen).verificar();
    if (!verificacion.ok) throw new CopiaInvalida(verificacion.motivo);
    return verificacion.eventos;
  } catch (e) {
    for (const ruta of escritas) await almacen.borrar(ruta);
    if (e instanceof CopiaInvalida) throw e;
    throw new CopiaInvalida(e instanceof Error ? e.message : 'no se pudo restaurar');
  }
}
