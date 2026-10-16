import { ErrorImportacion, LIMITES, type Tabla } from './tipos';

/**
 * Decodifica bytes de texto: BOM UTF-8/UTF-16 si lo hay; si no, UTF-8 estricto y, si falla,
 * windows-1252 (lo que guarda Excel en Windows como «CSV» en español, un superconjunto de latin1).
 */
export function decodificarTexto(bytes: Uint8Array): string {
  const [b0, b1, b2] = bytes;
  if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) return decodificar('utf-8', bytes.subarray(3));
  if (b0 === 0xff && b1 === 0xfe) return decodificar('utf-16le', bytes.subarray(2));
  if (b0 === 0xfe && b1 === 0xff) return decodificar('utf-16be', bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodificarLatin(bytes);
  }
}

function decodificar(codificacion: string, bytes: Uint8Array): string {
  try {
    return new TextDecoder(codificacion).decode(bytes);
  } catch {
    throw new ErrorImportacion('No se pudo leer el texto del archivo (codificación desconocida).');
  }
}

function decodificarLatin(bytes: Uint8Array): string {
  try {
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    // Entorno sin ICU: latin1 puro (cada byte es su punto de código)
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
  }
}

/**
 * Limpia el texto de una celda: &nbsp; y cualquier espacio o salto → un espacio; quita caracteres
 * de control e invisibles; recorta extremos y largo (LIMITES.caracteresCelda).
 */
export function limpiarCelda(texto: string): string {
  let s = texto
    .replace(/\p{Cc}/gu, ' ')
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > LIMITES.caracteresCelda) s = Array.from(s).slice(0, LIMITES.caracteresCelda).join('').trim();
  return s;
}

/** Acumula filas aplicando los límites mientras se lee (para no llenar la memoria antes de fallar). */
export class Acumulador {
  private readonly filas: Tabla = [];

  agregar(fila: string[]): void {
    while (fila.length > 0 && fila[fila.length - 1] === '') fila.pop();
    if (fila.length > LIMITES.columnas) {
      throw new ErrorImportacion(`El archivo tiene más de ${LIMITES.columnas} columnas; deja solo las del inventario.`);
    }
    this.filas.push(fila);
    if (this.filas.length > LIMITES.filas) throw demasiadasFilas();
  }

  /** Tabla final, sin las filas vacías del final. */
  cerrar(): Tabla {
    while (this.filas.length > 0 && this.filas[this.filas.length - 1]?.length === 0) this.filas.pop();
    return this.filas;
  }
}

export function demasiadasFilas(): ErrorImportacion {
  return new ErrorImportacion(
    `El archivo tiene más de ${LIMITES.filas.toLocaleString('es-CO')} filas; divídelo en partes más pequeñas.`,
  );
}

/** Quita tildes, pasa a minúsculas y deja un solo espacio entre palabras. */
export function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Clave para emparejar productos por nombre: sin tildes, mayúsculas ni espacios dobles. */
export function normalizarNombre(nombre: string): string {
  return sinTildes(nombre.replace(/\u00a0/g, ' '));
}

/** Clave para emparejar por código: sin espacios y en minúsculas. */
export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\s+/g, '').toLowerCase();
}
