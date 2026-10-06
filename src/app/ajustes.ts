import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * Preferencias de la app (tema, reproductor, vista de notas). Son de este teléfono, no de las
 * notas: viven en `localStorage` de la WebView, que es privado de la app y se borra con ella.
 * Las notas nunca van aquí (son archivos .md, ADR-002).
 */
export type Tema = 'sistema' | 'claro' | 'oscuro';
export type VistaNotas = 'tarjetas' | 'lista';
/** Lado de la pantalla donde se escondió el globo de música; `null` = visible. */
export type LadoEscondido = 'izquierda' | 'derecha' | null;
/** De dónde suena la música (ADR-013): reproductor de YouTube o la app de Spotify. */
export type Fuente = 'youtube' | 'spotify';

export interface Ajustes {
  tema: Tema;
  flotante: boolean;
  vistaNotas: VistaNotas;
  miniEscondido: LadoEscondido;
  fuente: Fuente;
  /** Client ID público de la app de Spotify del autor (Dashboard). No es un secreto. */
  spotifyClientId: string;
  /** Pedir huella/PIN al abrir y al volver tras un rato (ADR-014). Solo en el teléfono. */
  bloqueo: boolean;
}

export const AJUSTES_INICIALES: Ajustes = {
  tema: 'sistema',
  flotante: false,
  vistaNotas: 'tarjetas',
  miniEscondido: null,
  fuente: 'youtube',
  spotifyClientId: '',
  bloqueo: false,
};

const CLAVE = 'marginalia.ajustes.v1';
const TEMAS: readonly Tema[] = ['sistema', 'claro', 'oscuro'];
const VISTAS: readonly VistaNotas[] = ['tarjetas', 'lista'];

/** Lee lo guardado; cualquier valor raro o ausente vuelve al inicial (nunca rompe el arranque). */
export function leerAjustes(): Ajustes {
  let guardado: Record<string, unknown> = {};
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    if (crudo && typeof crudo === 'object' && !Array.isArray(crudo)) guardado = crudo as Record<string, unknown>;
  } catch {
    // almacenamiento bloqueado o JSON roto: valores iniciales
  }
  const { tema, flotante, vistaNotas, miniEscondido, fuente, spotifyClientId, bloqueo } = guardado;
  return {
    tema: TEMAS.includes(tema as Tema) ? (tema as Tema) : AJUSTES_INICIALES.tema,
    flotante: typeof flotante === 'boolean' ? flotante : AJUSTES_INICIALES.flotante,
    vistaNotas: VISTAS.includes(vistaNotas as VistaNotas) ? (vistaNotas as VistaNotas) : AJUSTES_INICIALES.vistaNotas,
    miniEscondido: miniEscondido === 'izquierda' || miniEscondido === 'derecha' ? miniEscondido : null,
    fuente: fuente === 'spotify' ? 'spotify' : 'youtube',
    spotifyClientId: typeof spotifyClientId === 'string' && /^[0-9a-f]{32}$/.test(spotifyClientId) ? spotifyClientId : '',
    bloqueo: bloqueo === true,
  };
}

export function guardarAjustes(ajustes: Ajustes): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ajustes));
  } catch {
    // sin almacenamiento: la preferencia dura hasta cerrar la app
  }
}

/**
 * Aplica el tema a <html>. "sistema" quita el atributo y manda el `prefers-color-scheme` del
 * teléfono. La barra de estado de Android toma el color de la meta `theme-color`, que se copia
 * del token `--papel` ya resuelto (una meta no puede leer variables CSS).
 */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);
  // Iconos de la barra de estado y de gestos: claros sobre el tema oscuro y al revés.
  if (Capacitor.isNativePlatform()) {
    const estilo = tema === 'oscuro' ? SystemBarsStyle.Dark : tema === 'claro' ? SystemBarsStyle.Light : SystemBarsStyle.Default;
    void SystemBars.setStyle({ style: estilo }).catch(() => undefined);
  }
  const papel = getComputedStyle(raiz).getPropertyValue('--papel').trim();
  if (!papel) return;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = papel;
    meta.removeAttribute('media');
  }
}
