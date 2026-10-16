/**
 * PIN de los usuarios de Bar Box (varias personas en el mismo teléfono).
 *
 * - El PIN tiene de 4 a 8 dígitos. Nunca se guarda: se guarda PBKDF2-SHA256 con una sal
 *   aleatoria de 16 bytes y 210 000 iteraciones (recomendación OWASP 2023 para SHA-256),
 *   con WebCrypto (sin dependencias).
 * - La comparación del hash es en tiempo constante (no corta en el primer byte distinto).
 * - Un PIN de 4 dígitos son 10 000 opciones: el hash solo no basta. `Limitador` frena los
 *   intentos: 5 fallos seguidos → espera creciente (30 s, 1 min, 2 min… hasta 15 min).
 *   Es puro: recibe la hora como parámetro, así se prueba sin relojes falsos.
 */
import type { PinGuardado } from './modelo';
import { ReglaRota } from './eventos';

export const ITERACIONES_PIN = 210_000;
const BYTES_SAL = 16;
const BYTES_HASH = 32;
const PATRON_PIN = /^\d{4,8}$/;

/** Lanza `ReglaRota` si el PIN no son de 4 a 8 dígitos. */
export function validarFormatoPin(pin: string): void {
  if (typeof pin !== 'string' || !PATRON_PIN.test(pin)) throw new ReglaRota('El PIN son de 4 a 8 dígitos.');
}

function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function derivar(pin: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteraciones },
    clave,
    BYTES_HASH * 8,
  );
  return new Uint8Array(bits);
}

/** Deriva el PIN para guardarlo. `iteraciones` sólo se baja en pruebas. */
export async function hashPin(pin: string, iteraciones: number = ITERACIONES_PIN): Promise<PinGuardado> {
  validarFormatoPin(pin);
  if (!Number.isSafeInteger(iteraciones) || iteraciones < 1) throw new RangeError('iteraciones inválidas');
  const sal = crypto.getRandomValues(new Uint8Array(BYTES_SAL));
  return { sal: aBase64(sal), hash: aBase64(await derivar(pin, sal, iteraciones)), iteraciones };
}

/** Compara dos arreglos sin cortar en el primer byte distinto (tiempo constante). */
export function igualesEnTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  let diferencia = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diferencia |= (a[i % a.length] ?? 0) ^ (b[i % b.length] ?? 0);
  return diferencia === 0;
}

/** ¿Este PIN corresponde al guardado? Un PIN mal formado o datos dañados: no. */
export async function verificarPin(pin: string, guardado: PinGuardado): Promise<boolean> {
  if (typeof pin !== 'string' || !PATRON_PIN.test(pin)) return false;
  try {
    const sal = deBase64(guardado.sal);
    const esperado = deBase64(guardado.hash);
    if (!Number.isSafeInteger(guardado.iteraciones) || guardado.iteraciones < 1 || guardado.iteraciones > 5_000_000) return false;
    return igualesEnTiempoConstante(await derivar(pin, sal, guardado.iteraciones), esperado);
  } catch {
    return false;
  }
}

// --- Limitador de intentos ------------------------------------------------------

export interface OpcionesLimitador {
  /** Fallos seguidos permitidos antes de esperar. */
  readonly fallosPermitidos: number;
  /** Primera espera, en ms; se duplica con cada fallo siguiente. */
  readonly esperaBaseMs: number;
  readonly esperaMaxMs: number;
}

export const LIMITADOR_POR_DEFECTO: OpcionesLimitador = {
  fallosPermitidos: 5,
  esperaBaseMs: 30_000,
  esperaMaxMs: 15 * 60_000,
};

interface Cuenta {
  fallos: number;
  bloqueadoHasta: number;
}

export type Permiso = { readonly permitido: true } | { readonly permitido: false; readonly esperaMs: number };

/**
 * Cuenta fallos por usuario. Tras `fallosPermitidos` fallos seguidos, cada fallo bloquea
 * un rato: base × 2^(fallos − fallosPermitidos), con tope. Un acierto lo reinicia.
 * Vive en memoria: reiniciar la app lo borra (el atacante tendría que reiniciar cada pocos
 * intentos, lo que ya lo frena; si hace falta más, `exportar`/`importar` lo guardan).
 */
export class Limitador {
  private readonly cuentas = new Map<string, Cuenta>();

  constructor(private readonly opciones: OpcionesLimitador = LIMITADOR_POR_DEFECTO) {}

  /** ¿Se puede intentar ahora? Si no, cuánto falta. */
  puedeIntentar(clave: string, ahora: number): Permiso {
    const c = this.cuentas.get(clave);
    if (!c || c.bloqueadoHasta <= ahora) return { permitido: true };
    return { permitido: false, esperaMs: c.bloqueadoHasta - ahora };
  }

  /** Anota un fallo y devuelve el estado resultante. */
  registrarFallo(clave: string, ahora: number): Permiso {
    const c = this.cuentas.get(clave) ?? { fallos: 0, bloqueadoHasta: 0 };
    c.fallos += 1;
    const exceso = c.fallos - this.opciones.fallosPermitidos;
    if (exceso >= 0) {
      const espera = Math.min(this.opciones.esperaMaxMs, this.opciones.esperaBaseMs * 2 ** Math.min(exceso, 30));
      c.bloqueadoHasta = ahora + espera;
    }
    this.cuentas.set(clave, c);
    return this.puedeIntentar(clave, ahora);
  }

  registrarExito(clave: string): void {
    this.cuentas.delete(clave);
  }

  fallos(clave: string): number {
    return this.cuentas.get(clave)?.fallos ?? 0;
  }

  exportar(): Record<string, Cuenta> {
    return Object.fromEntries([...this.cuentas].map(([k, v]) => [k, { ...v }]));
  }

  importar(datos: unknown): void {
    if (typeof datos !== 'object' || datos === null) return;
    for (const [k, v] of Object.entries(datos)) {
      const c = v as Partial<Cuenta> | null;
      if (c && Number.isSafeInteger(c.fallos) && Number.isSafeInteger(c.bloqueadoHasta)) {
        this.cuentas.set(k, { fallos: c.fallos as number, bloqueadoHasta: c.bloqueadoHasta as number });
      }
    }
  }
}
