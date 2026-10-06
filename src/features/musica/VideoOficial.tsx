import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';
import { urlIncrustada, type EnlaceMusica } from '../../core/musica/enlaces';
import './VideoOficial.css';

/** Origen del reproductor oficial (dominio sin cookies de seguimiento). */
export const ORIGEN_YOUTUBE = 'https://www.youtube-nocookie.com';

export interface InfoVideo {
  sonando: boolean;
  /** segundos */
  posicion: number;
  duracion: number;
  titulo?: string;
  /** Código de error del reproductor oficial (100: no existe · 101/150: no se permite incrustar) */
  error?: number;
}

/** Órdenes al reproductor: las mismas que usa la IFrame API oficial, por postMessage. */
export interface ControlVideo {
  reproducir(): void;
  pausar(): void;
  anterior(): void;
  siguiente(): void;
  saltar(segundo: number): void;
}

interface Props {
  enlace: EnlaceMusica;
  alCambiar: (info: Partial<InfoVideo>) => void;
  control: RefObject<ControlVideo | null>;
}

/**
 * Reproductor oficial de YouTube incrustado, visible y con sus controles y marca intactos
 * (docs/LEGAL.md §1). Con `enablejsapi=1` acepta órdenes por postMessage (play, pausa, saltar)
 * y avisa de su estado; solo se escuchan mensajes de su origen y de su propia ventana.
 */
export function VideoOficial({ enlace, alCambiar, control }: Props) {
  const marco = useRef<HTMLIFrameElement>(null);
  const avisar = useRef(alCambiar);
  avisar.current = alCambiar;

  useEffect(() => {
    const mandar = (func: string, args: unknown[] = []) =>
      marco.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }), ORIGEN_YOUTUBE);
    control.current = {
      reproducir: () => mandar('playVideo'),
      pausar: () => mandar('pauseVideo'),
      anterior: () => mandar('previousVideo'),
      siguiente: () => mandar('nextVideo'),
      saltar: (s) => mandar('seekTo', [s, true]),
    };

    const alMensaje = (e: MessageEvent) => {
      if (e.origin !== ORIGEN_YOUTUBE || e.source !== marco.current?.contentWindow || typeof e.data !== 'string') return;
      let datos: { event?: unknown; info?: unknown };
      try {
        datos = JSON.parse(e.data) as typeof datos;
      } catch {
        return;
      }
      if (datos.event === 'onError' && typeof datos.info === 'number') {
        avisar.current({ error: datos.info, sonando: false });
        return;
      }
      const info = datos.info && typeof datos.info === 'object' ? (datos.info as Record<string, unknown>) : null;
      if (!info) return;
      const cambio: Partial<InfoVideo> = {};
      // playerState: 1 = sonando, 2 = en pausa, 0 = terminó, 3 = cargando
      if (typeof info['playerState'] === 'number') cambio.sonando = info['playerState'] === 1 || info['playerState'] === 3;
      if (typeof info['currentTime'] === 'number') cambio.posicion = info['currentTime'];
      if (typeof info['duration'] === 'number' && info['duration'] > 0) cambio.duracion = info['duration'];
      const datosVideo = info['videoData'] as { title?: unknown } | undefined;
      if (typeof datosVideo?.title === 'string' && datosVideo.title) cambio.titulo = datosVideo.title.slice(0, 200);
      if (Object.keys(cambio).length > 0) avisar.current(cambio);
    };
    addEventListener('message', alMensaje);
    return () => {
      removeEventListener('message', alMensaje);
      control.current = null;
      // Cambiar de canción monta otro iframe: el estado real llega del nuevo (infoDelivery).
      // Quitar el reproductor del todo lo marca quien lo quita (cerrarFlotante).
    };
  }, [control]);

  // Pedirle al reproductor que avise de su estado (lo que hace la IFrame API al conectarse)
  function alCargar() {
    marco.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), ORIGEN_YOUTUBE);
  }

  return (
    <div class="video-oficial">
      <iframe
        ref={marco}
        class="video-oficial__marco"
        src={`${urlIncrustada(enlace, location.origin)}&autoplay=1`}
        title="Reproductor de YouTube"
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
        allowFullScreen
        onLoad={alCargar}
      />
    </div>
  );
}
