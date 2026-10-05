import type { Disco } from './almacen';

/**
 * Cifrado en reposo de las notas (ADR-008, pedido del autor 2026-10-05).
 *
 * - AES-256-GCM de WebCrypto (primitiva estándar del navegador, sin dependencias).
 * - Un IV aleatorio de 12 bytes por escritura. GCM autentica: un archivo alterado no se descifra.
 * - La ruta del archivo va como dato asociado (AAD): copiar el cifrado de una nota sobre otra
 *   tampoco se descifra. El temporal `x.md.tmp` usa la ruta final `x.md`.
 * - La clave es NO extraíble y vive en IndexedDB de la WebView (privada de la app, sin copia
 *   en la nube: allowBackup=false). Ni el código de la app puede leer sus bytes.
 *
 * Formato del archivo: una línea de cabecera y el resto en Base64 (IV ‖ texto cifrado ‖ etiqueta).
 * Los archivos sin cabecera se leen tal cual (notas de antes del cifrado o importadas):
 * se cifran al volver a guardarse, o de una vez con `cifrarPendientes`.
 */
export const CABECERA = 'MARGINALIA-CIFRADO v1\n';
const TEMPORAL = '.tmp';

export class NoSePuedeDescifrar extends Error {
  constructor(ruta: string) {
    super(`No se puede descifrar ${ruta}`);
    this.name = 'NoSePuedeDescifrar';
  }
}

export const estaCifrado = (texto: string) => texto.startsWith(CABECERA);

const rutaFinal = (ruta: string) => (ruta.endsWith(TEMPORAL) ? ruta.slice(0, -TEMPORAL.length) : ruta);
const codificador = new TextEncoder();

function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto.trim());
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export async function cifrarTexto(clave: CryptoKey, texto: string, ruta: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: codificador.encode(rutaFinal(ruta)) },
    clave,
    codificador.encode(texto),
  );
  const todo = new Uint8Array(iv.length + cifrado.byteLength);
  todo.set(iv);
  todo.set(new Uint8Array(cifrado), iv.length);
  return CABECERA + aBase64(todo);
}

export async function descifrarTexto(clave: CryptoKey, contenido: string, ruta: string): Promise<string> {
  try {
    const todo = deBase64(contenido.slice(CABECERA.length));
    const claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: todo.subarray(0, 12), additionalData: codificador.encode(rutaFinal(ruta)) },
      clave,
      todo.subarray(12),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(claro);
  } catch {
    throw new NoSePuedeDescifrar(ruta);
  }
}

/** Envuelve un `Disco`: lo que se escribe sale cifrado y lo que se lee entra en claro. */
export function discoCifrado(disco: Disco, obtenerClave: () => Promise<CryptoKey>): Disco {
  return {
    async leer(ruta) {
      const contenido = await disco.leer(ruta);
      if (contenido === null || !estaCifrado(contenido)) return contenido;
      return descifrarTexto(await obtenerClave(), contenido, ruta);
    },
    async escribir(ruta, contenido) {
      await disco.escribir(ruta, await cifrarTexto(await obtenerClave(), contenido, ruta));
    },
    renombrar: (origen, destino) => disco.renombrar(origen, destino),
    borrar: (ruta) => disco.borrar(ruta),
    listar: (carpeta) => disco.listar(carpeta),
  };
}

/**
 * Cifra de una vez los archivos `.md` de `carpeta` que aún están en claro. `crudo` lee sin
 * descifrar; `escribir` guarda por el camino normal (atómico y cifrado). Devuelve cuántos cifró.
 */
export async function cifrarPendientes(
  crudo: Disco,
  escribir: (ruta: string, contenido: string) => Promise<void>,
  carpeta: string,
): Promise<number> {
  let cifrados = 0;
  for (const nombre of await crudo.listar(carpeta)) {
    if (!nombre.endsWith('.md')) continue;
    const ruta = `${carpeta}/${nombre}`;
    const contenido = await crudo.leer(ruta);
    if (contenido === null || estaCifrado(contenido)) continue;
    await escribir(ruta, contenido);
    cifrados++;
  }
  return cifrados;
}

const BASE = 'marginalia-claves';
const ALMACEN = 'claves';
const ID_CLAVE = 'notas-v1';

function pedir<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error ?? new Error('IndexedDB'));
  });
}

let clavePrometida: Promise<CryptoKey> | undefined;

/**
 * Clave de las notas de este teléfono: la crea la primera vez (no extraíble) y la guarda en
 * IndexedDB. Si IndexedDB no existe (pruebas), falla: el llamador decide qué hacer.
 */
export function claveDelDispositivo(): Promise<CryptoKey> {
  clavePrometida ??= (async () => {
    const apertura = indexedDB.open(BASE, 1);
    apertura.onupgradeneeded = () => apertura.result.createObjectStore(ALMACEN);
    const db = await pedir(apertura);
    const guardada = await pedir(db.transaction(ALMACEN).objectStore(ALMACEN).get(ID_CLAVE));
    if (guardada instanceof CryptoKey) return guardada;
    const nueva = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const escritura = db.transaction(ALMACEN, 'readwrite');
    escritura.objectStore(ALMACEN).add(nueva, ID_CLAVE);
    await new Promise<void>((resolver, rechazar) => {
      escritura.oncomplete = () => resolver();
      escritura.onerror = () => rechazar(escritura.error ?? new Error('IndexedDB'));
    });
    return nueva;
  })();
  // Si falló, que el siguiente intento vuelva a probar
  clavePrometida.catch(() => (clavePrometida = undefined));
  return clavePrometida;
}
