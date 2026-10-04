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
}

/**
 * Reproductor grande al estilo de la referencia: portada vacía, título, progreso con punto, 3 controles y volumen.
 * F1: estático, sin sonido. Anterior y siguiente aún no hacen nada (F4).
 */
export function Reproductor({ titulo, artista, posicion, duracion, sonando, alAlternar }: PropsReproductor) {
  const actual = formatearTiempo(posicion);
  const total = formatearTiempo(duracion);
  return (
    <section class="reproductor" aria-label="Reproductor">
      <div class="reproductor__cabecera">
        <div class="reproductor__portada" aria-hidden="true" />
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
        <button type="button" class="reproductor__control" aria-label="Anterior">
          <Icono nombre="anterior" tamano={32} />
        </button>
        <button type="button" class="reproductor__control" aria-label={sonando ? 'Pausar' : 'Reproducir'} onClick={alAlternar}>
          <Icono nombre={sonando ? 'pausa' : 'reproducir'} tamano={40} />
        </button>
        <button type="button" class="reproductor__control" aria-label="Siguiente">
          <Icono nombre="siguiente" tamano={32} />
        </button>
      </div>

      <div class="reproductor__volumen">
        <Icono nombre="volumen-bajo" />
        <LineaPunto fraccion={0.8} etiqueta="Volumen" valorTexto="80 %" />
        <Icono nombre="volumen-alto" />
      </div>
    </section>
  );
}
