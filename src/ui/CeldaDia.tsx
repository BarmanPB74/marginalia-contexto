import './CeldaDia.css';

interface Props {
  dia: number;
  notas: number;
  hoy?: boolean;
  /** día del mes anterior o siguiente que completa la cuadrícula */
  fuera?: boolean;
  alTocar?: () => void;
}

const MAX_MARCAS = 3;

function descripcion(dia: number, notas: number, hoy: boolean): string {
  const partes = [String(dia)];
  if (hoy) partes.push('hoy');
  if (notas > 0) partes.push(notas === 1 ? '1 nota' : `${notas} notas`);
  return partes.join(', ');
}

/** Día del calendario: número, resaltador si es hoy y una raya corta por nota (máx. 3). */
export function CeldaDia({ dia, notas, hoy = false, fuera = false, alTocar }: Props) {
  const clases = ['celda-dia', hoy && 'celda-dia--hoy', fuera && 'celda-dia--fuera'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      class={clases}
      aria-label={descripcion(dia, notas, hoy)}
      aria-current={hoy ? 'date' : undefined}
      onClick={alTocar}
    >
      <span class="celda-dia__numero">{dia}</span>
      <span class="celda-dia__notas" aria-hidden="true">
        {Array.from({ length: Math.min(notas, MAX_MARCAS) }, (_, i) => (
          <span key={i} class="celda-dia__nota" />
        ))}
      </span>
    </button>
  );
}
