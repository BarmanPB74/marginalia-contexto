/*
 * SPIKE TEMPORAL DE F0 — borrar al empezar F4.
 * Pregunta: ¿carga el reproductor oficial incrustado de YouTube dentro de la WebView de Capacitor?
 * Solo un <iframe> oficial; sin IFrame API, sin controles propios (eso es F4).
 * Video: demo oficial de la documentación de la IFrame API de YouTube.
 */
import { useState } from 'preact/hooks';

const VIDEO_DEMO = 'M7lc1UVf-VE';

const ORIGENES = {
  nocookie: 'https://www.youtube-nocookie.com',
  youtube: 'https://www.youtube.com',
} as const;

type Origen = keyof typeof ORIGENES;

export function urlEmbed(origen: Origen): string {
  return `${ORIGENES[origen]}/embed/${VIDEO_DEMO}`;
}

export function SpikeReproductor() {
  const [origen, setOrigen] = useState<Origen | null>(null);

  return (
    <section class="spike" aria-label="Prueba del reproductor">
      <p class="spike-nota">Prueba temporal del reproductor</p>
      <div class="spike-botones">
        <button type="button" onClick={() => setOrigen('nocookie')}>
          Probar A (nocookie)
        </button>
        <button type="button" onClick={() => setOrigen('youtube')}>
          Probar B (youtube.com)
        </button>
      </div>
      {origen && (
        <iframe
          class="spike-iframe"
          title={`Reproductor de prueba ${origen}`}
          src={urlEmbed(origen)}
          allow="encrypted-media; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
    </section>
  );
}
