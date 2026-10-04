import './LineaPunto.css';

interface Props {
  /** 0 … 1 */
  fraccion: number;
  etiqueta: string;
  valorTexto: string;
}

/** La línea con un punto de la referencia: progreso y volumen. Solo muestra (F1); tocarla para saltar llega en F4. */
export function LineaPunto({ fraccion, etiqueta, valorTexto }: Props) {
  const porcentaje = Math.round(Math.max(0, Math.min(1, fraccion)) * 100);
  return (
    <div
      class="linea-punto"
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      aria-valuetext={valorTexto}
    >
      <span class="linea-punto__punto" style={{ left: `${porcentaje}%` }} />
    </div>
  );
}
