/**
 * Enlaces de YouTube y YouTube Music → lo que necesita el reproductor oficial incrustado
 * (docs/LEGAL.md §1: solo IFrame oficial; se guardan ID y metadatos, nunca el audio).
 */
export interface EnlaceMusica {
  /** ID de video (11 caracteres) */
  video?: string;
  /** ID de lista de reproducción o álbum */
  lista?: string;
  /** segundo de inicio */
  inicio?: number;
}

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const ID_LISTA = /^[A-Za-z0-9_-]{10,64}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);

/** "1m30s" / "90" / "90s" → 90 */
function segundos(t: string | null): number | undefined {
  if (!t) return undefined;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  if (!m || !t) return undefined;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : undefined;
}

/**
 * Lee un enlace pegado o compartido (puede venir con texto alrededor, como el de "Compartir"
 * de YouTube Music). Devuelve null si no es de YouTube o no trae un ID válido.
 */
export function leerEnlace(texto: string): EnlaceMusica | null {
  const candidato = /https?:\/\/\S+/.exec(texto)?.[0] ?? texto.trim();
  let url: URL;
  try {
    url = new URL(candidato);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  let video: string | null = url.searchParams.get('v');
  const tramos = url.pathname.split('/').filter(Boolean);
  if (url.hostname.endsWith('youtu.be')) video = tramos[0] ?? null;
  else if (tramos[0] === 'shorts' || tramos[0] === 'embed' || tramos[0] === 'live') video = tramos[1] ?? null;

  const lista = url.searchParams.get('list');
  const resultado: EnlaceMusica = {};
  if (video && ID_VIDEO.test(video)) resultado.video = video;
  if (lista && ID_LISTA.test(lista)) resultado.lista = lista;
  const inicio = segundos(url.searchParams.get('t') ?? url.searchParams.get('start'));
  if (inicio !== undefined) resultado.inicio = inicio;
  return resultado.video || resultado.lista ? resultado : null;
}

/** Dirección del reproductor oficial, en el dominio sin cookies de seguimiento. */
export function urlIncrustada(e: EnlaceMusica, origen: string): string {
  const base = e.video
    ? `https://www.youtube-nocookie.com/embed/${e.video}`
    : 'https://www.youtube-nocookie.com/embed/videoseries';
  const p = new URLSearchParams({ playsinline: '1', rel: '0', enablejsapi: '1', origin: origen });
  if (e.lista) p.set('list', e.lista);
  if (e.inicio) p.set('start', String(e.inicio));
  return `${base}?${p.toString()}`;
}

/** Para "Abrir en YouTube Music" (Android lo abre en la app oficial si está instalada). */
export function urlYoutubeMusic(e: EnlaceMusica): string {
  if (e.video) {
    const p = new URLSearchParams({ v: e.video });
    if (e.lista) p.set('list', e.lista);
    return `https://music.youtube.com/watch?${p.toString()}`;
  }
  return `https://music.youtube.com/playlist?list=${e.lista ?? ''}`;
}
