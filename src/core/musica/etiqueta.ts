import type { Nota } from '../notas/nota';

/**
 * Etiqueta de canción de una nota (docs/FORMATO_NOTAS.md). Dos fuentes:
 * - YouTube: `cancion: { yt: VIDEOID, … }` y en línea `[♪ 1:39](yt:VIDEOID?t=99)`;
 * - Spotify (ADR-013): `cancion: { spotify: spotify:track:ID, … }` y en línea `[♪ 1:39](spotify:track:ID?t=99)`.
 * Solo se aceptan identificadores válidos; todo lo demás se trata como texto.
 */
export interface EtiquetaCancion {
  /** ID de video de YouTube (11 caracteres) */
  yt?: string;
  /** URI de Spotify (`spotify:track:…`, `spotify:episode:…`) */
  spotify?: string;
  titulo?: string;
  artista?: string;
  /** segundo exacto */
  t?: number;
}

export const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
/** Solo pistas y episodios: lo que se puede marcar en un segundo exacto. */
export const URI_SPOTIFY = /^spotify:(track|episode):[A-Za-z0-9]{22}$/;
const SEGUNDOS_MAX = 24 * 3600;

const segundoValido = (t: unknown): t is number =>
  typeof t === 'number' && Number.isInteger(t) && t >= 0 && t <= SEGUNDOS_MAX;

/** La fuente de una etiqueta: el ID de YouTube o la URI de Spotify. */
export const idDe = (c: Pick<EtiquetaCancion, 'yt' | 'spotify'>): string => c.yt ?? c.spotify ?? '';
export const esSpotify = (id: string) => URI_SPOTIFY.test(id);

/** La canción principal de la nota, o null si no tiene o está mal escrita. */
export function cancionDeNota(nota: Pick<Nota, 'extra'>): EtiquetaCancion | null {
  const c = nota.extra['cancion'];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const datos = c as Record<string, unknown>;
  const yt = typeof datos['yt'] === 'string' && ID_VIDEO.test(datos['yt']) ? datos['yt'] : undefined;
  const spotify = typeof datos['spotify'] === 'string' && URI_SPOTIFY.test(datos['spotify']) ? datos['spotify'] : undefined;
  if (!yt && !spotify) return null;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined);
  const titulo = texto(datos['titulo']);
  const artista = texto(datos['artista']);
  return {
    ...(yt ? { yt } : { spotify: spotify as string }),
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
        ...(cancion.yt ? { yt: cancion.yt } : { spotify: cancion.spotify }),
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

/**
 * `[♪ 1:39](yt:ID?t=99)` o `[♪ 1:39](spotify:track:ID?t=99)` — enlace estándar de Markdown;
 * otros editores lo ven como texto. `id` es el ID de YouTube o la URI de Spotify.
 */
export function enlaceCancion(id: string, t = 0): string {
  const s = Math.max(0, Math.floor(t));
  if (ID_VIDEO.test(id)) return `[♪ ${minutoSegundo(s)}](yt:${id}?t=${s})`;
  if (URI_SPOTIFY.test(id)) return `[♪ ${minutoSegundo(s)}](${id}?t=${s})`;
  throw new Error('Canción no válida');
}

/** "yt:ID?t=99" / "spotify:track:ID?t=99" → { id, t } o null si no es válido. */
export function leerHrefCancion(href: string): { id: string; t: number } | null {
  const m =
    /^yt:([A-Za-z0-9_-]{11})(?:\?t=(\d{1,6}))?$/.exec(href) ??
    /^(spotify:(?:track|episode):[A-Za-z0-9]{22})(?:\?t=(\d{1,6}))?$/.exec(href);
  if (!m?.[1]) return null;
  return { id: m[1], t: Math.min(Number(m[2] ?? 0), SEGUNDOS_MAX) };
}

/** Ruta que abre Música y pone esa canción (YouTube o Spotify) desde ese segundo. */
export function rutaCancion(id: string, t = 0): string {
  const s = Math.max(0, Math.floor(t));
  if (URI_SPOTIFY.test(id)) return `#/musica?sp=${encodeURIComponent(id.slice('spotify:'.length))}&t=${s}`;
  return `#/musica?yt=${id}&t=${s}`;
}
