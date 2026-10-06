import { diaDe } from '../../core/notas/fechas';
import { exportarZip, leerZip, MAX_ZIP, ZipInvalido } from '../../core/exportar/zip';
import { guardarExportado } from '../../core/exportar/guardar';
import type { RepositorioNotas } from '../../core/notas/repositorio';

/** Copia de seguridad de todas las notas en ZIP (Ajustes y paleta de comandos). Devuelve el mensaje para la persona. */
export async function exportarCopia(repo: RepositorioNotas, hoy = new Date()): Promise<string> {
  const { notas } = await repo.listar();
  if (notas.length === 0) return 'No hay notas que exportar.';
  const donde = await guardarExportado(`marginalia-${diaDe(hoy)}.zip`, exportarZip(notas) as Uint8Array<ArrayBuffer>, 'application/zip');
  const cuantas = notas.length === 1 ? '1 nota exportada' : `${notas.length} notas exportadas`;
  return `${cuantas} sin cifrar en ${donde}. Guárdalo en un lugar seguro.`;
}

/**
 * Abre el selector de archivos del sistema. Debe llamarse dentro de un toque (o Intro):
 * Android solo deja abrir el selector como respuesta a un gesto.
 */
export function elegirZip(): Promise<File | null> {
  return new Promise((resolver) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = '.zip,application/zip';
    entrada.addEventListener('change', () => resolver(entrada.files?.[0] ?? null), { once: true });
    entrada.addEventListener('cancel', () => resolver(null), { once: true });
    entrada.click();
  });
}

export async function importarCopia(repo: RepositorioNotas, archivo: File): Promise<string> {
  if (archivo.size > MAX_ZIP) return 'Ese archivo supera 100 MB: no parece una copia de Marginalia.';
  let lectura;
  try {
    lectura = leerZip(new Uint8Array(await archivo.arrayBuffer()));
  } catch (e) {
    return e instanceof ZipInvalido ? e.message : 'No se pudo leer el archivo.';
  }
  const { nuevas, iguales, copias } = await repo.importar(lectura.notas);
  const partes = [nuevas === 1 ? '1 nota importada' : `${nuevas} notas importadas`];
  if (iguales) partes.push(iguales === 1 ? '1 ya estaba' : `${iguales} ya estaban`);
  if (copias) partes.push(copias === 1 ? '1 distinta entró como copia' : `${copias} distintas entraron como copia`);
  const { rechazados } = lectura;
  if (rechazados.length) {
    const ejemplos = rechazados
      .slice(0, 3)
      .map((r) => `${r.archivo} (${r.motivo})`)
      .join(', ');
    partes.push(`${rechazados.length} archivo${rechazados.length === 1 ? '' : 's'} rechazado${rechazados.length === 1 ? '' : 's'}: ${ejemplos}${rechazados.length > 3 ? '…' : ''}`);
  }
  return `${partes.join(' · ')}.`;
}
