import type { ComponentChildren } from 'preact';
import { useId, useRef } from 'preact/hooks';
import { useFocoAtrapado } from './foco';
import { Icono } from './Icono';
import './Boton.css';
import './Dialogo.css';

interface Props {
  titulo: string;
  /** Explicación (qué pasará) */
  children: ComponentChildren;
  alConfirmar: () => void;
  alCerrar: () => void;
  etiquetaConfirmar?: string | undefined;
  etiquetaCancelar?: string | undefined;
  /** Acción destructiva (borrar, anular): botón rojo y aviso */
  peligro?: boolean | undefined;
}

/**
 * Diálogo de confirmación modal (alertdialog). El foco entra en «Cancelar» (lo seguro), queda
 * atrapado dentro, Escape o tocar el velo cancelan, y al cerrar vuelve a donde estaba.
 * Se muestra mientras quien lo usa lo monte.
 */
export function Dialogo({
  titulo,
  children,
  alConfirmar,
  alCerrar,
  etiquetaConfirmar = 'Confirmar',
  etiquetaCancelar = 'Cancelar',
  peligro = false,
}: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const id = useId();
  useFocoAtrapado(caja, alCerrar, cancelar);
  return (
    <div class="dialogo">
      <div class="dialogo__velo" aria-hidden="true" onClick={alCerrar} />
      <div
        ref={caja}
        class={`dialogo__caja${peligro ? ' dialogo__caja--peligro' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={`${id}-texto`}
        tabIndex={-1}
      >
        {peligro && (
          <span class="dialogo__icono" aria-hidden="true">
            <Icono nombre="alerta" tamano={28} />
          </span>
        )}
        <h2 class="dialogo__titulo" id={`${id}-titulo`}>
          {titulo}
        </h2>
        <div class="dialogo__texto" id={`${id}-texto`}>
          {children}
        </div>
        <div class="dialogo__acciones">
          <button ref={cancelar} type="button" class="boton boton--contorno" onClick={alCerrar}>
            {etiquetaCancelar}
          </button>
          <button type="button" class={`boton ${peligro ? 'boton--peligro' : 'boton--primario'}`} onClick={alConfirmar}>
            {etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
