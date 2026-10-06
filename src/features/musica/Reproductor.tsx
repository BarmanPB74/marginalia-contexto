import type { ComponentChildren } from 'preact';
import { Icono } from '../../ui/Icono';
import { LineaPunto } from './LineaPunto';
import { formatearTiempo } from './tiempo';
import './Reproductor.css';

export interface PropsReproductor {
  titulo: string;
  artista: string;
  /** segundos */
  posicion: number;
  duracion: number;
  sonando: boolean;
  alAlternar: () => void;
  alAnterior?: () => void;
  alSiguiente?: () => void;
  /** El reproductor oficial de YouTube; si está, ocupa el sitio de la portada dibujada. */
  video?: ComponentChildren;
  /** Volumen 0…1 (el reproductor oficial no lo informa: solo se dibuja) */
  volumen?: number;
}

/**
 * Reproductor grande al estilo de la referencia: portada vacía, título, progreso con punto, 3 controles y volumen.
 * Con `video`, controla el reproductor oficial de YouTube; sin él es solo el dibujo (galería).
 */
export function Reproductor({
  titulo,
  artista,
  posicion,
  duracion,
  sonando,
  alAlternar,
  alAnterior,
  alSiguiente,
  video,
  volumen = 0.8,
}: PropsReproductor) {
  const actual = formatearTiempo(posicion);
  const total = formatearTiempo(duracion);
  return (
    <section class="reproductor" aria-label="Reproductor">
      {video}
      <div class="reproductor__cabecera">
        {!video && <div class="reproductor__portada" aria-hidden="true" />}
        <div class="reproductor__datos">
          <p class="reproductor__titulo">{titulo}</p>
          <p class="reproductor__artista">{artista}</p>
        </div>
      </div>

      <LineaPunto fraccion={duracion ? posicion / duracion : 0} etiqueta="Progreso" valorTexto={`${actual} de ${total}`} />
      <div class="reproductor__tiempos" aria-hidden="true">
        <span>{actual}</span>
        <span>−{formatearTiempo(duracion - posicion)}</span>
      </div>

      <div class="reproductor__controles">
        <button type="button" class="reproductor__control" aria-label="Anterior" onClick={alAnterior}>
          <Icono nombre="anterior" tamano={32} />
        </button>
        <button type="button" class="reproductor__control" aria-label={sonando ? 'Pausar' : 'Reproducir'} onClick={alAlternar}>
          <Icono nombre={sonando ? 'pausa' : 'reproducir'} tamano={40} />
        </button>
        <button type="button" class="reproductor__control" aria-label="Siguiente" onClick={alSiguiente}>
          <Icono nombre="siguiente" tamano={32} />
        </button>
      </div>

      {!video && (
      <div class="reproductor__volumen">
        <Icono nombre="volumen-bajo" />
        <LineaPunto fraccion={volumen} etiqueta="Volumen" valorTexto={`${Math.round(volumen * 100)} %`} />
        <Icono nombre="volumen-alto" />
      </div>
      )}
    </section>
  );
}
