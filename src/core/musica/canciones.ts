import type { EnlaceMusica } from './enlaces';

/**
 * Canciones guardadas: solo el enlace (IDs) y metadatos (título, artista). Nunca el audio
 * (docs/LEGAL.md §1). Son pocas y de este teléfono: viven en localStorage de la WebView.
 */
export interface Cancion {
  /** video o lista: identifica la canción en la lista guardada */
  clave: string;
  enlace: EnlaceMusica;
  titulo: string;
  artista: string;
}

const CLAVE = 'marginalia.canciones.v1';
const MAXIMO = 200;

export const claveDe = (e: EnlaceMusica) => e.video ?? `lista:${e.lista ?? ''}`;

function esCancion(v: unknown): v is Cancion {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  const e = c['enlace'] as Record<string, unknown> | undefined;
  return (
    typeof c['clave'] === 'string' &&
    typeof c['titulo'] === 'string' &&
    typeof c['artista'] === 'string' &&
    !!e &&
    typeof e === 'object' &&
    (typeof e['video'] === 'string' || typeof e['lista'] === 'string')
  );
}

export function leerCanciones(): Cancion[] {
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(crudo) ? crudo.filter(esCancion).slice(0, MAXIMO) : [];
  } catch {
    return [];
  }
}

export function guardarCanciones(lista: readonly Cancion[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAXIMO)));
  } catch {
    // sin almacenamiento: la lista dura hasta cerrar la app
  }
}

/** Añade al principio; si ya estaba, la sube (sin duplicar). */
export function conCancion(lista: readonly Cancion[], nueva: Cancion): Cancion[] {
  return [nueva, ...lista.filter((c) => c.clave !== nueva.clave)];
}

/**
 * Título y artista por oEmbed público de YouTube (permitido en LEGAL §1; red bajo demanda).
 * Sin red o si YouTube no responde, devuelve null y se usa un nombre genérico.
 */
export async function metadatos(e: EnlaceMusica, espera = 6000): Promise<{ titulo: string; artista: string } | null> {
  const pagina = e.video
    ? `https://www.youtube.com/watch?v=${e.video}`
    : `https://www.youtube.com/playlist?list=${e.lista ?? ''}`;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), espera);
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(pagina)}`, {
      signal: control.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!r.ok) return null;
    const datos = (await r.json()) as { title?: unknown; author_name?: unknown };
    const titulo = typeof datos.title === 'string' ? datos.title.slice(0, 200) : '';
    // YouTube Music publica los temas en canales "Artista - Topic"
    const artista = typeof datos.author_name === 'string' ? datos.author_name.replace(/ - Topic$/, '').slice(0, 120) : '';
    return titulo ? { titulo, artista } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/** Miniatura oficial (i.ytimg.com, ya permitido por la CSP). */
export const miniatura = (e: EnlaceMusica) => (e.video ? `https://i.ytimg.com/vi/${e.video}/mqdefault.jpg` : null);
