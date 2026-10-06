import { fechasDeNota, type Dia } from '../notas/fechas';
import { leerNota, type Nota } from '../notas/nota';
import { sinCodigo } from './codigo';

/**
 * Parser de la sintaxis propia de una nota (docs/FORMATO_NOTAS.md). Funciones puras.
 * - `#etiqueta`: precedida de inicio o espacio, empieza por letra o dígito, admite tildes, ñ,
 *   `_`, `-` y `/` (subetiquetas, como Obsidian). Solo números (`#1`) no cuenta. `# Título` tampoco.
 * - Fechas: ver `fechas.ts`. Canciones: `[♪ m:ss](yt:VIDEOID?t=SEG)`. Enlaces: `[[Título]]`.
 * Nada se interpreta dentro de código.
 */

export interface CancionEnLinea {
  yt: string;
  t?: number;
}

export interface Analisis {
  fechas: Dia[];
  etiquetas: string[];
  canciones: CancionEnLinea[];
  enlaces: string[];
}

export const MAX_ETIQUETA = 64;
export const ETIQUETA_EN_TEXTO = /(^|[\s(])#([\p{L}\p{N}][\p{L}\p{N}_\-/]*)/gu;
const CANCION = /\[♪[^\]\n]*\]\(yt:([A-Za-z0-9_-]{11})(?:\?t=(\d{1,6}))?\)/g;
const ENLACE = /\[\[([^[\]\n|]{1,200})(?:\|[^[\]\n]*)?\]\]/g;

/** "#Estudio" y "#estudio" son la misma etiqueta: se compara en minúsculas. */
export const claveEtiqueta = (e: string) => e.toLocaleLowerCase('es');

function sinRepetir(lista: string[]): string[] {
  const vistas = new Set<string>();
  return lista.filter((e) => {
    const k = claveEtiqueta(e);
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

export function etiquetasDeTexto(texto: string): string[] {
  const halladas: string[] = [];
  for (const m of sinCodigo(texto).matchAll(ETIQUETA_EN_TEXTO)) {
    const etiqueta = (m[2] ?? '').replace(/[-/_]+$/, '');
    if (etiqueta.length > MAX_ETIQUETA || /^\d+$/.test(etiqueta)) continue;
    halladas.push(etiqueta);
  }
  return sinRepetir(halladas);
}

/** Etiquetas del frontmatter y del texto, sin repetir (gana como se escribió la primera vez). */
export function etiquetasDeNota(nota: Pick<Nota, 'etiquetas' | 'cuerpo'>): string[] {
  return sinRepetir([...nota.etiquetas.map((e) => e.replace(/^#/, '').trim()).filter(Boolean), ...etiquetasDeTexto(nota.cuerpo)]);
}

export function analizarNota(nota: Pick<Nota, 'etiquetas' | 'cuerpo' | 'extra'>): Analisis {
  const texto = sinCodigo(nota.cuerpo);
  const canciones: CancionEnLinea[] = [];
  for (const m of texto.matchAll(CANCION)) {
    const yt = m[1] ?? '';
    canciones.push(m[2] ? { yt, t: Number(m[2]) } : { yt });
  }
  const enlaces = [...new Set([...texto.matchAll(ENLACE)].map((m) => (m[1] ?? '').trim()).filter(Boolean))];
  return { fechas: fechasDeNota(nota), etiquetas: etiquetasDeNota(nota), canciones, enlaces };
}

/** `parseNota(texto) → { meta, fechas, etiquetas, canciones, enlaces }` (FORMATO_NOTAS.md, regla 6). */
export function parseNota(texto: string): Analisis & { meta: Nota } {
  const meta = leerNota(texto);
  return { meta, ...analizarNota(meta) };
}
