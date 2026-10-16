import { guardarExportado } from '../../core/exportar/guardar';
import { diaDe } from '../../core/notas/fechas';
import { CopiaInvalida, crearCopiaNegocio, restaurarCopiaNegocio } from '../../core/negocio/copia';
import type { Almacen } from '../../core/almacen/almacen';
import { almacenDeLaApp } from '../notas/contexto';

/** Exporta la copia completa del negocio (ZIP legible) a Documentos/Stark o como descarga. */
export async function exportarCopiaNegocio(almacen: Almacen = almacenDeLaApp(), hoy = new Date()): Promise<string> {
  const zip = await crearCopiaNegocio(almacen);
  const donde = await guardarExportado(`stark-copia-${diaDe(hoy)}.zip`, zip as Uint8Array<ArrayBuffer>, 'application/zip');
  return `Copia del negocio guardada en ${donde}. No está cifrada: guárdala fuera del teléfono, en un lugar seguro.`;
}

/** Restaura una copia (solo en un negocio vacío) y recarga la app para abrirla. */
export async function restaurarDesdeArchivo(archivo: File, almacen: Almacen = almacenDeLaApp()): Promise<string> {
  try {
    const n = await restaurarCopiaNegocio(almacen, new Uint8Array(await archivo.arrayBuffer()));
    return `Copia restaurada: ${n} movimientos. Entra con tu PIN de siempre.`;
  } catch (e) {
    return e instanceof CopiaInvalida ? e.message : 'No se pudo restaurar la copia.';
  }
}
