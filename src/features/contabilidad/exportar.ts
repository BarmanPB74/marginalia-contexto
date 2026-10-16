import { guardarExportado } from '../../core/exportar/guardar';
import { diaDe } from '../../core/notas/fechas';
import { resumenACsv, ventasACsv, type Negocio, type Periodo } from '../../core/negocio';

/**
 * Exportar la contabilidad a CSV (`;`, con BOM para que Excel lea las tildes). El texto del CSV lo
 * arma el núcleo (`resumenACsv`, `ventasACsv`), que ya protege contra la inyección de fórmulas.
 * Teléfono: Documentos/Stark. Navegador: descarga (Blob + enlace con `download`).
 * Devuelve el mensaje para la persona.
 */
const TIPO_CSV = 'text/csv';

export function nombreArchivo(tipo: 'resumen' | 'ventas', hoy: Date): string {
  return tipo === 'resumen' ? `stark-contabilidad-${diaDe(hoy)}.csv` : `stark-contabilidad-ventas-${diaDe(hoy)}.csv`;
}

export async function exportarResumen(negocio: Negocio, periodo: Periodo, hoy = new Date()): Promise<string> {
  const csv = resumenACsv(await negocio.contabilidad(periodo), { bom: true });
  const donde = await guardarExportado(nombreArchivo('resumen', hoy), csv, TIPO_CSV);
  return `Resumen guardado en ${donde}. Es un archivo sin cifrar: guárdalo en un lugar seguro.`;
}

export async function exportarVentas(negocio: Negocio, periodo: Periodo, hoy = new Date()): Promise<string> {
  // Hasta hoy (no hasta el fin del período): así una anulación posterior saca la venta del CSV
  const eventos = await negocio.eventos({ desde: periodo.desde });
  const csv = ventasACsv(eventos, periodo, { bom: true });
  const donde = await guardarExportado(nombreArchivo('ventas', hoy), csv, TIPO_CSV);
  return `Ventas guardadas en ${donde}. Es un archivo sin cifrar: guárdalo en un lugar seguro.`;
}
