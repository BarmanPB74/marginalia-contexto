import type { Almacen, Disco } from './almacen';
import { CABECERA_V2 } from './cifrado';

/**
 * Clave de las notas envuelta por Android Keystore (ADR-014, F5 · H6).
 *
 * - La clave de datos (AES-256, 32 bytes al azar) cifra las notas como siempre (WebCrypto).
 * - Esa clave se guarda **envuelta**: cifrada con otra clave AES-GCM que vive en el Keystore
 *   del teléfono (hardware/TEE; StrongBox si existe) y que nunca sale de él.
 * - En disco solo queda `claves/notas.v2` (envuelta). Copiar los archivos de la app a otro
 *   teléfono, o leerlos desde una copia, no sirve sin ese Keystore.
 * - Al abrir la app, el Keystore la desenvuelve y se importa a WebCrypto como NO extraíble.
 *
 * El archivo de la clave vive junto a las notas (misma carpeta privada): ya no depende de que
 * se conserven los datos de la WebView, que era un riesgo de ADR-008.
 */
export interface Envoltorio {
  /** Base64 de la clave en claro → Base64 de la clave envuelta (IV ‖ cifrado) */
  envolver(clave: string): Promise<string>;
  desenvolver(envuelta: string): Promise<string>;
}

export const RUTA_CLAVE = 'claves/notas.v2';
const BYTES = 32;

export class ClavePerdida extends Error {
  constructor() {
    super('Hay notas cifradas con Keystore pero falta su clave: no se crea otra para no dejarlas ilegibles.');
    this.name = 'ClavePerdida';
  }
}

const aBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
function deBase64(t: string): Uint8Array<ArrayBuffer> {
  const binario = atob(t);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function importar(crudaB64: string): Promise<CryptoKey> {
  const cruda = deBase64(crudaB64);
  try {
    if (cruda.length !== BYTES) throw new Error('La clave desenvuelta no mide 32 bytes');
    return await crypto.subtle.importKey('raw', cruda, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } finally {
    // Que los bytes no queden en memoria más de lo necesario
    cruda.fill(0);
  }
}

/** ¿Hay alguna nota ya cifrada con v2? (sin su clave, crear otra las perdería). */
async function hayNotasV2(crudo: Disco, carpeta: string): Promise<boolean> {
  for (const nombre of await crudo.listar(carpeta)) {
    if ((await crudo.leer(`${carpeta}/${nombre}`))?.startsWith(CABECERA_V2)) return true;
  }
  return false;
}

/**
 * La clave v2 de este teléfono: la desenvuelve si existe; si no, la crea, la envuelve, comprueba
 * que se puede desenvolver y la guarda (escritura atómica). Nunca la reemplaza si ya hay notas v2.
 */
export async function claveDelKeystore(
  almacen: Almacen,
  crudo: Disco,
  envoltorio: Envoltorio,
  carpetaNotas = 'notas',
): Promise<CryptoKey> {
  const guardada = await almacen.leer(RUTA_CLAVE);
  if (guardada !== null) return importar(await envoltorio.desenvolver(guardada.trim()));
  if (await hayNotasV2(crudo, carpetaNotas)) throw new ClavePerdida();
  const nueva = crypto.getRandomValues(new Uint8Array(BYTES));
  try {
    const envuelta = await envoltorio.envolver(aBase64(nueva));
    // Antes de guardarla: el Keystore debe poder deshacer lo que acaba de hacer
    if ((await envoltorio.desenvolver(envuelta)) !== aBase64(nueva)) throw new Error('El Keystore no devolvió la misma clave');
    // Última comprobación justo antes de escribir: jamás pisar una clave que sí existía
    if ((await almacen.leer(RUTA_CLAVE)) !== null) throw new Error('La clave apareció mientras se creaba otra');
    await almacen.escribir(RUTA_CLAVE, envuelta);
    return await importar(aBase64(nueva));
  } finally {
    nueva.fill(0);
  }
}
