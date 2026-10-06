/**
 * Enlaces de Spotify (ADR-013). Spotify suena en su propia app (App Remote): aquí solo se leen
 * y validan las URIs que se le pasan. Nada se descarga ni se guarda salvo la URI y metadatos.
 */
export type TipoSpotify = 'track' | 'episode' | 'album' | 'playlist';

export interface EnlaceSpotify {
  /** `spotify:track:ID` … */
  uri: string;
  tipo: TipoSpotify;
}

const ID = /^[A-Za-z0-9]{22}$/;
const TIPOS: readonly TipoSpotify[] = ['track', 'episode', 'album', 'playlist'];
export const URI_REPRODUCIBLE = /^spotify:(track|episode|album|playlist):[A-Za-z0-9]{22}$/;

/**
 * Lee lo que da «Compartir → Copiar enlace» en Spotify (puede venir con texto alrededor):
 * `https://open.spotify.com/(intl-es/)track/ID?si=…` o `spotify:track:ID`. Solo hosts de Spotify.
 */
export function leerEnlaceSpotify(texto: string): EnlaceSpotify | null {
  const uri = /spotify:(track|episode|album|playlist):([A-Za-z0-9]{22})(?![A-Za-z0-9])/.exec(texto);
  if (uri?.[1] && uri[2]) return { uri: `spotify:${uri[1]}:${uri[2]}`, tipo: uri[1] as TipoSpotify };
  const candidato = /https?:\/\/\S+/.exec(texto)?.[0];
  if (!candidato) return null;
  let url: URL;
  try {
    url = new URL(candidato);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') return null;
  const tramos = url.pathname.split('/').filter(Boolean);
  if (tramos[0]?.startsWith('intl-')) tramos.shift();
  const [tipo, id] = tramos;
  if (!tipo || !id || !TIPOS.includes(tipo as TipoSpotify) || !ID.test(id)) return null;
  return { uri: `spotify:${tipo}:${id}`, tipo: tipo as TipoSpotify };
}

/** Para «Abrir en Spotify». */
export function urlSpotify(uri: string): string {
  const [, tipo, id] = uri.split(':');
  return `https://open.spotify.com/${tipo ?? ''}/${id ?? ''}`;
}
