import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * Preferencias de la app (tema, vista de notas, bloqueo). Son de este teléfono, no de las
 * notas: viven en `localStorage` de la WebView, que es privado de la app y se borra con ella.
 * Las notas nunca van aquí (son archivos .md, ADR-002).
 */
export type Tema = 'sistema' | 'claro' | 'oscuro';
export type VistaNotas = 'tarjetas' | 'lista';

export interface Ajustes {
  tema: Tema;
  vistaNotas: VistaNotas;
  /** Pedir huella/PIN al abrir y al volver tras un rato (ADR-014). Solo en el teléfono. */
  bloqueo: boolean;
}

export const AJUSTES_INICIALES: Ajustes = {
  tema: 'sistema',
  vistaNotas: 'tarjetas',
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
  const { tema, vistaNotas, bloqueo } = guardado;
  return {
    tema: TEMAS.includes(tema as Tema) ? (tema as Tema) : AJUSTES_INICIALES.tema,
    vistaNotas: VISTAS.includes(vistaNotas as VistaNotas) ? (vistaNotas as VistaNotas) : AJUSTES_INICIALES.vistaNotas,
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
