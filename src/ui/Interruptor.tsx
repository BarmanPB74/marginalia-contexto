import { useId } from 'preact/hooks';
import './Interruptor.css';

interface Props {
  etiqueta: string;
  activo: boolean;
  alCambiar: (activo: boolean) => void;
  /** Línea secundaria bajo la etiqueta */
  descripcion?: string;
  desactivado?: boolean;
}

/** Interruptor (switch): toda la fila es tocable; la pista se pinta de primario al encenderse. */
export function Interruptor({ etiqueta, activo, alCambiar, descripcion, desactivado = false }: Props) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-describedby={descripcion ? id : undefined}
      class="interruptor"
      disabled={desactivado}
      onClick={() => alCambiar(!activo)}
    >
      <span class="interruptor__texto">
        {etiqueta}
        {descripcion && (
          <span class="interruptor__descripcion" id={id}>
            {descripcion}
          </span>
        )}
      </span>
      <span class="interruptor__pista" aria-hidden="true">
        <span class="interruptor__punto" />
      </span>
    </button>
  );
}
