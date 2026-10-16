/**
 * Adjuntos del negocio: foto o PDF de una factura de compra o del soporte de un gasto.
 *
 * Se guardan en el almacén de la app (el mismo cifrado de notas y diario) como
 * `negocio/adjuntos/<ulid>.json` = `{ tipo, nombre, tamano, datosBase64 }`. El cifrado lo pone
 * el almacén; aquí solo se valida, se reduce y se codifica.
 *
 * - El tipo se decide por el CONTENIDO (firmas JPEG, PNG, WebP, PDF), nunca por la extensión ni
 *   por lo que diga el navegador: el archivo viene de fuera y se trata como entrada hostil.
 * - Máximo 10 MB de origen. Las imágenes se reducen a ≤ 1600 px de lado en JPEG 0,8 (una foto de
 *   12 MP queda en unos 300 kB). Sin canvas (pruebas, WebView vieja) se guarda tal cual si pesa
 *   ≤ 3 MB.
 */
import type { Almacen } from '../../core/almacen/almacen';
import { esUlid, ulid } from '../../core/notas/ulid';

export const CARPETA_ADJUNTOS = 'negocio/adjuntos';
/** Tamaño máximo del archivo que elige la persona. */
export const MAX_ORIGEN = 10 * 1024 * 1024;
/** Sin poder reducir, una imagen se guarda tal cual solo hasta este tamaño. */
export const MAX_SIN_REDUCIR = 3 * 1024 * 1024;
/** Lado mayor de la imagen guardada, en píxeles. */
export const LADO_MAXIMO = 1600;
export const CALIDAD_JPEG = 0.8;
/** Nombre visible del archivo (solo para mostrarlo en la ficha). */
const MAX_NOMBRE = 80;

export type TipoAdjunto = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export interface Adjunto {
  readonly id: string;
  readonly tipo: TipoAdjunto;
  readonly nombre: string;
  /** Bytes guardados (después de reducir). */
  readonly tamano: number;
  readonly bytes: Uint8Array;
}

/** Lo que se escribe en el JSON (el almacén lo cifra). */
interface Guardado {
  tipo: TipoAdjunto;
  nombre: string;
  tamano: number;
  datosBase64: string;
}

/** Error con un mensaje listo para la persona. */
export class ErrorAdjunto extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAdjunto';
  }
}

/** Reduce una imagen; devuelve null si no puede (sin canvas, imagen dañada). */
export type Reductor = (bytes: Uint8Array, tipo: TipoAdjunto) => Promise<Uint8Array | null>;

const TIPOS: readonly TipoAdjunto[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const empieza = (b: Uint8Array, firma: readonly number[], desde = 0) => firma.every((x, i) => b[desde + i] === x);

/** Tipo real del archivo según sus primeros bytes; null si no es JPEG, PNG, WebP ni PDF. */
export function tipoPorFirma(b: Uint8Array): TipoAdjunto | null {
  if (empieza(b, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // RIFF....WEBP
  if (empieza(b, [0x52, 0x49, 0x46, 0x46]) && empieza(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (empieza(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  return null;
}

export const esImagen = (tipo: TipoAdjunto) => tipo !== 'application/pdf';

/** Bytes → base64, por trozos (un `String.fromCharCode(...10 MB)` revienta la pila). */
export function aBase64(bytes: Uint8Array): string {
  let binario = '';
  const TROZO = 0x8000;
  for (let i = 0; i < bytes.length; i += TROZO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TROZO));
  }
  return btoa(binario);
}

export function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  const r = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) r[i] = binario.charCodeAt(i);
  return r;
}

/** Nombre visible sin rutas ni caracteres de control, recortado. */
function limpiarNombre(nombre: string, tipo: TipoAdjunto): string {
  // eslint-disable-next-line no-control-regex
  const base = (nombre.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const limpio = Array.from(base).slice(0, MAX_NOMBRE).join('');
  return limpio || (tipo === 'application/pdf' ? 'factura.pdf' : 'foto.jpg');
}

const ruta = (id: string) => `${CARPETA_ADJUNTOS}/${id}.json`;

/** Lee un `File`/`Blob` como bytes (con respaldo para entornos sin `arrayBuffer`). */
export async function leerBytes(archivo: Blob): Promise<Uint8Array> {
  if (typeof archivo.arrayBuffer === 'function') return new Uint8Array(await archivo.arrayBuffer());
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(new Uint8Array(lector.result as ArrayBuffer));
    lector.onerror = () => rechazar(new ErrorAdjunto('No se pudo leer el archivo.'));
    lector.readAsArrayBuffer(archivo);
  });
}

/**
 * Reductor del navegador: `createImageBitmap` + `<canvas>` → JPEG 0,8 con el lado mayor ≤ 1600 px.
 * Devuelve null si el entorno no tiene canvas o la imagen no se puede decodificar.
 */
export const reducirConCanvas: Reductor = async (bytes, tipo) => {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  try {
    const imagen = await createImageBitmap(new Blob([bytes as BlobPart], { type: tipo }));
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(imagen.width * escala));
    lienzo.height = Math.max(1, Math.round(imagen.height * escala));
    const ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    // Fondo blanco: un PNG con transparencia no queda negro al pasar a JPEG
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', CALIDAD_JPEG));
    return blob ? await leerBytes(blob) : null;
  } catch {
    return null;
  }
};

/**
 * Valida, reduce (si es imagen) y guarda. Devuelve el id que va en `adjuntos` de la compra o en
 * `adjunto` del gasto. Lanza `ErrorAdjunto` con un mensaje para la persona.
 */
export async function guardarAdjunto(
  almacen: Almacen,
  archivo: { bytes: Uint8Array; nombre: string },
  opciones: { reducir?: Reductor; ahora?: number } = {},
): Promise<string> {
  const { bytes } = archivo;
  if (bytes.length === 0) throw new ErrorAdjunto('El archivo está vacío.');
  if (bytes.length > MAX_ORIGEN) throw new ErrorAdjunto('El archivo pesa más de 10 MB. Toma la foto otra vez o reduce el PDF.');
  const tipoOrigen = tipoPorFirma(bytes);
  if (!tipoOrigen) throw new ErrorAdjunto('Solo se aceptan fotos (JPEG, PNG o WebP) o PDF.');

  let tipo: TipoAdjunto = tipoOrigen;
  let datos = bytes;
  if (esImagen(tipoOrigen)) {
    const reducida = await (opciones.reducir ?? reducirConCanvas)(bytes, tipoOrigen);
    // Solo se usa si de verdad es un JPEG (un reductor roto no cuela otra cosa)
    if (reducida && reducida.length > 0 && tipoPorFirma(reducida) === 'image/jpeg' && reducida.length <= MAX_ORIGEN) {
      tipo = 'image/jpeg';
      datos = reducida;
    } else if (bytes.length > MAX_SIN_REDUCIR) {
      throw new ErrorAdjunto('No se pudo reducir la foto y pesa más de 3 MB. Tómala con menos resolución.');
    }
  }

  const id = ulid(opciones.ahora ?? Date.now());
  const nombre = limpiarNombre(archivo.nombre, tipo).replace(/\.(jpe?g|png|webp)$/i, tipo === 'image/jpeg' ? '.jpg' : '.$1');
  const guardado: Guardado = { tipo, nombre, tamano: datos.length, datosBase64: aBase64(datos) };
  await almacen.escribir(ruta(id), JSON.stringify(guardado));
  return id;
}

/** Lee un adjunto. null si no existe; `ErrorAdjunto` si el contenido no es válido. */
export async function leerAdjunto(almacen: Almacen, id: string): Promise<Adjunto | null> {
  if (!esUlid(id)) return null;
  const texto = await almacen.leer(ruta(id));
  if (texto === null) return null;
  let g: Partial<Guardado>;
  try {
    g = JSON.parse(texto) as Partial<Guardado>;
  } catch {
    throw new ErrorAdjunto('El adjunto está dañado.');
  }
  if (typeof g.datosBase64 !== 'string' || !TIPOS.includes(g.tipo as TipoAdjunto)) throw new ErrorAdjunto('El adjunto está dañado.');
  const bytes = deBase64(g.datosBase64);
  // El tipo guardado debe coincidir con el contenido: nada de servir un «PDF» que es otra cosa
  if (tipoPorFirma(bytes) !== g.tipo) throw new ErrorAdjunto('El adjunto está dañado.');
  return {
    id,
    tipo: g.tipo as TipoAdjunto,
    nombre: typeof g.nombre === 'string' ? g.nombre : 'adjunto',
    tamano: bytes.length,
    bytes,
  };
}

/** Borra un adjunto (solo para deshacer uno recién guardado cuyo registro falló). */
export async function borrarAdjunto(almacen: Almacen, id: string): Promise<void> {
  if (esUlid(id)) await almacen.borrar(ruta(id));
}

/** «1,2 MB», «340 kB». */
export function tamanoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}
