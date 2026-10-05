import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { leerEnlace, type EnlaceMusica } from '../../core/musica/enlaces';

/**
 * Lo que llega por «Compartir → Marginalia» (plugin nativo CompartidoPlugin.java).
 * El texto viene de otra app: es entrada NO confiable. Solo se usa si contiene un enlace de
 * YouTube/YouTube Music con un ID válido (leerEnlace); todo lo demás se descarta.
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

/** Escucha lo compartido (solo en el teléfono). Devuelve cómo dejar de escuchar. */
export function escucharCompartido(alRecibir: (enlace: EnlaceMusica | null) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  const asa = Compartido.addListener('compartido', (datos) => alRecibir(enlaceCompartido(datos.texto)));
  return () => void asa.then((a) => a.remove());
}
