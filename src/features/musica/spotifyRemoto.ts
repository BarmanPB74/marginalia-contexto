import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Puente con el plugin nativo SpotifyPlugin.java (ADR-013). Spotify suena en su propia app
 * (también en segundo plano y con la pantalla apagada); aquí solo se envían órdenes y se
 * recibe qué suena y en qué segundo. Lo que llega del lado nativo se valida antes de usarlo.
 */
export interface EstadoSpotify {
  pausado: boolean;
  posicionMs: number;
  uri?: string;
  titulo?: string;
  artista?: string;
  duracionMs?: number;
}

interface PluginSpotify {
  instalado(): Promise<{ instalado: boolean }>;
  conectar(o: { clientId: string }): Promise<void>;
  desconectar(): Promise<void>;
  reproducir(o: { uri: string; posicionMs: number }): Promise<void>;
  pausar(): Promise<void>;
  reanudar(): Promise<void>;
  siguiente(): Promise<void>;
  anterior(): Promise<void>;
  saltar(o: { posicionMs: number }): Promise<void>;
  estado(): Promise<unknown>;
  addListener(evento: 'estado', alCambiar: (datos: unknown) => void): Promise<PluginListenerHandle>;
}

export const Spotify = registerPlugin<PluginSpotify>('Spotify');

/** Solo en el teléfono: en el navegador no hay app de Spotify que controlar. */
export const spotifyDisponible = (): boolean => Capacitor.isNativePlatform();

export const CLIENT_ID = /^[0-9a-f]{32}$/;
const MS_MAX = 24 * 3600 * 1000;

const ms = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), MS_MAX) : undefined;
const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined;

/** Datos del plugin → estado limpio, o null si no tienen forma de estado. */
export function estadoSeguro(datos: unknown): EstadoSpotify | null {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const d = datos as Record<string, unknown>;
  if (typeof d['pausado'] !== 'boolean') return null;
  const uri = typeof d['uri'] === 'string' && /^spotify:[a-z]+:[A-Za-z0-9]{22}$/.test(d['uri']) ? d['uri'] : undefined;
  const titulo = texto(d['titulo']);
  const artista = texto(d['artista']);
  const duracionMs = ms(d['duracionMs']);
  return {
    pausado: d['pausado'],
    posicionMs: ms(d['posicionMs']) ?? 0,
    ...(uri ? { uri } : {}),
    ...(titulo ? { titulo } : {}),
    ...(artista ? { artista } : {}),
    ...(duracionMs ? { duracionMs } : {}),
  };
}

/**
 * Segundo actual: Spotify solo avisa al cambiar algo (pausa, salto, otra pista), así que
 * mientras suena se suma el tiempo pasado desde el último aviso, sin pasar de la duración.
 */
export function segundoAhora(estado: EstadoSpotify | null, recibido: number, ahora: number): number {
  if (!estado) return 0;
  const extra = estado.pausado ? 0 : Math.max(0, ahora - recibido);
  const total = estado.posicionMs + extra;
  const tope = estado.duracionMs ?? Number.POSITIVE_INFINITY;
  return Math.floor(Math.min(total, tope) / 1000);
}

/** Código de error del plugin → mensaje claro para la persona. */
export function mensajeSpotify(error: unknown): string {
  const codigo = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  switch (codigo) {
    case 'SIN_APP':
      return 'Instala la app de Spotify en este teléfono para escuchar desde aquí.';
    case 'SIN_SESION':
      return 'Inicia sesión en la app de Spotify y vuelve a conectar.';
    case 'NO_AUTORIZADO':
      return 'Spotify no autorizó a Marginalia. Revisa el Client ID, la huella SHA-1 y que tu cuenta esté en la lista de usuarios de tu app en el Dashboard de Spotify.';
    case 'CLIENT_ID':
      return 'El Client ID no es válido: son 32 letras y números del Dashboard de Spotify.';
    case 'DESCONECTADO':
      return 'Spotify se desconectó. Toca «Conectar con Spotify».';
    case 'URI':
      return 'Ese enlace de Spotify no se puede reproducir.';
    default:
      return 'No se pudo hablar con Spotify. Abre la app de Spotify y prueba de nuevo.';
  }
}
