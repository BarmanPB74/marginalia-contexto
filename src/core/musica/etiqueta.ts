import type { Nota } from '../notas/nota';

/**
 * Etiqueta de canción de una nota (docs/FORMATO_NOTAS.md):
 * - principal, en el frontmatter: `cancion: { yt, titulo, artista, t }`;
 * - en línea: `[♪ 1:39](yt:VIDEOID?t=99)`.
 * Solo se aceptan IDs de 11 caracteres válidos; todo lo demás se trata como texto.
 */
export interface EtiquetaCancion {
  yt: string;
  titulo?: string;
  artista?: string;
  /** segundo exacto */
  t?: number;
}

export const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const SEGUNDOS_MAX = 24 * 3600;

const segundoValido = (t: unknown): t is number =>
  typeof t === 'number' && Number.isInteger(t) && t >= 0 && t <= SEGUNDOS_MAX;

/** La canción principal de la nota, o null si no tiene o está mal escrita. */
export function cancionDeNota(nota: Pick<Nota, 'extra'>): EtiquetaCancion | null {
  const c = nota.extra['cancion'];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const datos = c as Record<string, unknown>;
  const yt = datos['yt'];
  if (typeof yt !== 'string' || !ID_VIDEO.test(yt)) return null;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined);
  const titulo = texto(datos['titulo']);
  const artista = texto(datos['artista']);
  return {
    yt,
    ...(titulo ? { titulo } : {}),
    ...(artista ? { artista } : {}),
    ...(segundoValido(datos['t']) ? { t: datos['t'] } : {}),
  };
}

/** Pone (o cambia) la canción principal en el frontmatter, sin tocar lo demás. */
export function conCancionPrincipal(nota: Nota, cancion: EtiquetaCancion): Nota {
  const t = cancion.t !== undefined ? Math.max(0, Math.min(SEGUNDOS_MAX, Math.floor(cancion.t))) : undefined;
  return {
    ...nota,
    extra: {
      ...nota.extra,
      cancion: {
        yt: cancion.yt,
        ...(cancion.titulo ? { titulo: cancion.titulo } : {}),
        ...(cancion.artista ? { artista: cancion.artista } : {}),
        ...(t !== undefined ? { t } : {}),
      },
    },
  };
}

/** 99 → "1:39" */
export function minutoSegundo(t: number): string {
  const total = Math.max(0, Math.floor(t));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** `[♪ 1:39](yt:dQw4w9WgXcQ?t=99)` — enlace estándar de Markdown; otros editores lo ven como texto. */
export function enlaceCancion(yt: string, t = 0): string {
  if (!ID_VIDEO.test(yt)) throw new Error('ID de video no válido');
  const s = Math.max(0, Math.floor(t));
  return `[♪ ${minutoSegundo(s)}](yt:${yt}?t=${s})`;
}

/** "yt:ID?t=99" → { yt, t } o null si no es válido. */
export function leerHrefCancion(href: string): { yt: string; t: number } | null {
  const m = /^yt:([A-Za-z0-9_-]{11})(?:\?t=(\d{1,6}))?$/.exec(href);
  if (!m?.[1]) return null;
  const t = Number(m[2] ?? 0);
  return { yt: m[1], t: Math.min(t, SEGUNDOS_MAX) };
}

/** Ruta que abre Música y pone esa canción desde ese segundo. */
export const rutaCancion = (yt: string, t = 0) => `#/musica?yt=${yt}&t=${Math.max(0, Math.floor(t))}`;
