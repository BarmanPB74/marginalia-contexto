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
 * La cabecera dice qué clave lo cifró (ADR-014):
 * - `v1`: clave no extraíble en IndexedDB de la WebView (ADR-008; navegador y versiones anteriores).
 * - `v2`: clave de datos envuelta por Android Keystore (`boveda.ts`): en disco solo queda envuelta.
 * Los archivos sin cabecera se leen tal cual (notas de antes del cifrado o importadas):
 * se cifran al volver a guardarse, o de una vez con `cifrarPendientes`.
 */
export const CABECERA = 'MARGINALIA-CIFRADO v1\n';
export const CABECERA_V2 = 'MARGINALIA-CIFRADO v2\n';
const TEMPORAL = '.tmp';

export class NoSePuedeDescifrar extends Error {
  constructor(ruta: string) {
    super(`No se puede descifrar ${ruta}`);
    this.name = 'NoSePuedeDescifrar';
  }
}

export const estaCifrado = (texto: string) => texto.startsWith(CABECERA) || texto.startsWith(CABECERA_V2);

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

export async function cifrarTexto(clave: CryptoKey, texto: string, ruta: string, cabecera = CABECERA): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: codificador.encode(rutaFinal(ruta)) },
    clave,
    codificador.encode(texto),
  );
  const todo = new Uint8Array(iv.length + cifrado.byteLength);
  todo.set(iv);
  todo.set(new Uint8Array(cifrado), iv.length);
  return cabecera + aBase64(todo);
}

export async function descifrarTexto(clave: CryptoKey, contenido: string, ruta: string): Promise<string> {
  try {
    const todo = deBase64(contenido.slice(contenido.indexOf('\n') + 1));
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

/** Qué clave usar para cada versión y con cuál se escribe. */
export interface Claves {
  /** Versión con la que se escribe todo lo nuevo (o cómo averiguarla, una vez) */
  escribir: 'v1' | 'v2' | (() => Promise<'v1' | 'v2'>);
  /** Clave v1; `null` si ya no existe (migración terminada) */
  v1?: () => Promise<CryptoKey | null>;
  v2?: () => Promise<CryptoKey>;
}

/** Envuelve un `Disco`: lo que se escribe sale cifrado y lo que se lee entra en claro. */
export function discoCifrado(disco: Disco, claves: Claves | (() => Promise<CryptoKey>)): Disco {
  const c: Claves = typeof claves === 'function' ? { escribir: 'v1', v1: claves } : claves;
  async function clave(version: 'v1' | 'v2', ruta: string): Promise<CryptoKey> {
    const obtener = version === 'v2' ? c.v2 : c.v1;
    const k = obtener ? await obtener() : null;
    if (!k) throw new NoSePuedeDescifrar(ruta);
    return k;
  }
  return {
    async leer(ruta) {
      const contenido = await disco.leer(ruta);
      if (contenido === null || !estaCifrado(contenido)) return contenido;
      const version = contenido.startsWith(CABECERA_V2) ? 'v2' : 'v1';
      return descifrarTexto(await clave(version, ruta), contenido, ruta);
    },
    async escribir(ruta, contenido) {
      const version = typeof c.escribir === 'function' ? await c.escribir() : c.escribir;
      const cabecera = version === 'v2' ? CABECERA_V2 : CABECERA;
      await disco.escribir(ruta, await cifrarTexto(await clave(version, ruta), contenido, ruta, cabecera));
    },
    renombrar: (origen, destino) => disco.renombrar(origen, destino),
    borrar: (ruta) => disco.borrar(ruta),
    listar: (carpeta) => disco.listar(carpeta),
  };
}

/**
 * Cifra de una vez los archivos `.md` de `carpeta` que aún están en claro. `crudo` lee sin
 * descifrar; `escribir` guarda por el camino normal (atómico y cifrado). Devuelve cuántos cifró.
 * Con `destino` (p. ej. `CABECERA_V2`) también vuelve a cifrar los que tengan otra cabecera,
 * leyéndolos con `leerClaro`: es la migración v1 → v2. Un archivo que no se pueda descifrar se
 * deja como está (y la clave vieja no se borra, ver `quedanConCabecera`).
 */
export async function cifrarPendientes(
  crudo: Disco,
  escribir: (ruta: string, contenido: string) => Promise<void>,
  carpeta: string,
  opciones: { destino?: string; leerClaro?: (ruta: string) => Promise<string | null> } = {},
): Promise<number> {
  let cifrados = 0;
  for (const nombre of await crudo.listar(carpeta)) {
    if (!nombre.endsWith('.md')) continue;
    const ruta = `${carpeta}/${nombre}`;
    const contenido = await crudo.leer(ruta);
    if (contenido === null) continue;
    const hecho = opciones.destino ? contenido.startsWith(opciones.destino) : estaCifrado(contenido);
    if (hecho) continue;
    let claro: string | null = contenido;
    if (estaCifrado(contenido)) {
      if (!opciones.leerClaro) continue;
      try {
        claro = await opciones.leerClaro(ruta);
      } catch {
        continue;
      }
    }
    if (claro === null) continue;
    await escribir(ruta, claro);
    cifrados++;
  }
  return cifrados;
}

/** ¿Queda algún archivo de `carpeta` (también temporales) con esta cabecera? */
export async function quedanConCabecera(crudo: Disco, carpeta: string, cabecera: string): Promise<boolean> {
  for (const nombre of await crudo.listar(carpeta)) {
    const contenido = await crudo.leer(`${carpeta}/${nombre}`);
    if (contenido?.startsWith(cabecera)) return true;
  }
  return false;
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

async function abrirBase(): Promise<IDBDatabase> {
  const apertura = indexedDB.open(BASE, 1);
  apertura.onupgradeneeded = () => apertura.result.createObjectStore(ALMACEN);
  return pedir(apertura);
}

/** La clave v1 si existe, sin crearla (para leer notas viejas durante la migración). */
export async function claveV1SiExiste(): Promise<CryptoKey | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await abrirBase();
  const guardada = await pedir(db.transaction(ALMACEN).objectStore(ALMACEN).get(ID_CLAVE));
  return guardada instanceof CryptoKey ? guardada : null;
}

/** Borra la clave v1 cuando ya ninguna nota la necesita (migración a Keystore terminada). */
export async function borrarClaveV1(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await abrirBase();
  const t = db.transaction(ALMACEN, 'readwrite');
  t.objectStore(ALMACEN).delete(ID_CLAVE);
  await new Promise<void>((resolver, rechazar) => {
    t.oncomplete = () => resolver();
    t.onerror = () => rechazar(t.error ?? new Error('IndexedDB'));
  });
  clavePrometida = undefined;
}

/**
 * Clave de las notas de este teléfono: la crea la primera vez (no extraíble) y la guarda en
 * IndexedDB. Si IndexedDB no existe (pruebas), falla: el llamador decide qué hacer.
 */
export function claveDelDispositivo(): Promise<CryptoKey> {
  clavePrometida ??= (async () => {
    const db = await abrirBase();
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
