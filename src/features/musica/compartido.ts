import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { leerEnlace, type EnlaceMusica } from '../../core/musica/enlaces';
import { leerEnlaceSpotify, type EnlaceSpotify } from '../../core/musica/spotify';

/**
 * Lo que llega por «Compartir → Marginalia» (plugin nativo CompartidoPlugin.java).
 * El texto viene de otra app: es entrada NO confiable. Solo se usa si contiene un enlace de
 * YouTube/YouTube Music (leerEnlace) o de Spotify (leerEnlaceSpotify, ADR-013) con un ID válido;
 * todo lo demás se descarta.
 */
interface PluginCompartido {
  addListener(evento: 'compartido', alRecibir: (datos: { texto?: unknown }) => void): Promise<PluginListenerHandle>;
}

const Compartido = registerPlugin<PluginCompartido>('Compartido');

/** Texto compartido → enlace de música, o null si no sirve. Pura, para probarla. */
export function enlaceCompartido(texto: unknown): EnlaceMusica | null {
  if (typeof texto !== 'string' || texto.length > 2000) return null;
  return leerEnlace(texto);
}

/** Texto compartido → enlace de Spotify, o null si no sirve. */
export function spotifyCompartido(texto: unknown): EnlaceSpotify | null {
  if (typeof texto !== 'string' || texto.length > 2000) return null;
  return leerEnlaceSpotify(texto);
}

/** Escucha lo compartido (solo en el teléfono). Devuelve cómo dejar de escuchar. */
export function escucharCompartido(
  alRecibir: (enlace: EnlaceMusica | null, spotify: EnlaceSpotify | null) => void,
): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  const asa = Compartido.addListener('compartido', (datos) =>
    alRecibir(enlaceCompartido(datos.texto), spotifyCompartido(datos.texto)),
  );
  return () => void asa.then((a) => a.remove());
}
