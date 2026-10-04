import './Interruptor.css';

interface Props {
  etiqueta: string;
  activo: boolean;
  alCambiar: (activo: boolean) => void;
}

/** Interruptor: un trazo con el mismo punto que la barra del reproductor. */
export function Interruptor({ etiqueta, activo, alCambiar }: Props) {
  return (
    <button type="button" role="switch" aria-checked={activo} class="interruptor" onClick={() => alCambiar(!activo)}>
      <span class="interruptor__texto">{etiqueta}</span>
      <span class="interruptor__pista" aria-hidden="true">
        <span class="interruptor__punto" />
      </span>
    </button>
  );
}
