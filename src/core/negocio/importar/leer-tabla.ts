import { leerCsv } from './csv';
import { leerHtml } from './html';
import { decodificarTexto } from './texto';
import { ErrorImportacion, LIMITES, type Tabla } from './tipos';
import { leerXlsx } from './xlsx';

const FIRMA_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04];

export type FormatoTabla = 'html' | 'csv' | 'xlsx';

const empiezaCon = (bytes: Uint8Array, firma: readonly number[]): boolean =>
  firma.every((b, i) => bytes[i] === b);

/**
 * Qué hay dentro del archivo, mirando el contenido (nunca la extensión: muchos «.xls» son en
 * realidad una tabla HTML). Lanza `ErrorImportacion` para formatos no soportados.
 */
export function detectarFormato(bytes: Uint8Array, nombreArchivo = 'el archivo'): FormatoTabla {
  if (empiezaCon(bytes, FIRMA_OLE)) {
    throw new ErrorImportacion(
      `«${nombreArchivo}» es un libro de Excel antiguo (.xls binario) y no se puede leer aquí. ` +
        'Guárdalo como .xlsx o .csv desde Excel y vuelve a importarlo.',
    );
  }
  if (empiezaCon(bytes, FIRMA_ZIP)) return 'xlsx';
  const inicio = decodificarTexto(bytes.subarray(0, 4096));
  if (inicio.includes('\0')) {
    throw new ErrorImportacion(`«${nombreArchivo}» no es una hoja de cálculo ni un texto legible.`);
  }
  if (/^\s*</.test(inicio)) {
    if (/urn:schemas-microsoft-com:office:spreadsheet/i.test(inicio) && !/<table[\s>]/i.test(inicio)) {
      throw new ErrorImportacion(
        `«${nombreArchivo}» es una hoja XML de Excel 2003. Guárdalo como .xlsx o .csv desde Excel.`,
      );
    }
    return 'html';
  }
  return 'csv';
}

/**
 * Lee la tabla de un archivo de inventario: tabla HTML (los «.xls» que son una página web),
 * CSV/TSV o .xlsx. Devuelve filas de celdas de texto limpias; sin interpretar números.
 * `nombreArchivo` solo se usa en los mensajes de error.
 */
export function leerTabla(bytes: Uint8Array, nombreArchivo: string): Tabla {
  if (bytes.length > LIMITES.bytes) {
    throw new ErrorImportacion(`«${nombreArchivo}» pesa más de 10 MB; exporta solo el inventario.`);
  }
  if (bytes.length === 0) throw new ErrorImportacion(`«${nombreArchivo}» está vacío.`);
  const formato = detectarFormato(bytes, nombreArchivo);
  let tabla: Tabla;
  if (formato === 'xlsx') {
    tabla = leerXlsx(bytes);
  } else {
    const texto = decodificarTexto(bytes);
    if (formato === 'html') {
      if (!/<table[\s>]/i.test(texto)) throw new ErrorImportacion(`«${nombreArchivo}» no contiene ninguna tabla.`);
      tabla = leerHtml(texto);
    } else {
      tabla = leerCsv(texto);
    }
  }
  if (!tabla.some((f) => f.some((c) => c !== ''))) {
    throw new ErrorImportacion(`«${nombreArchivo}» no tiene datos.`);
  }
  return tabla;
}
