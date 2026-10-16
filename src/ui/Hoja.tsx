import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { useFocoAtrapado } from './foco';
import './Hoja.css';

interface Props {
  titulo: string;
  alCerrar: () => void;
  children: ComponentChildren;
  /** Zona fija al pie (p. ej. «Aplicar filtros»): no se desplaza con el contenido */
  pie?: ComponentChildren | undefined;
}

/**
 * Hoja inferior: sube desde abajo sobre un velo. Se cierra tocando el velo, con Escape o con el
 * botón atrás del teclado. El foco queda dentro mientras está abierta y vuelve al cerrarla.
 */
export function Hoja({ titulo, alCerrar, children, pie }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useFocoAtrapado(panel, alCerrar);

  return (
    <div class="hoja">
      <div class="hoja__velo" onClick={alCerrar} aria-hidden="true" />
      <div ref={panel} class="hoja__panel" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}>
        <span class="hoja__asa" aria-hidden="true" />
        <p class="hoja__titulo" aria-hidden="true">
          {titulo}
        </p>
        <div class="hoja__contenido">{children}</div>
        {pie && <div class="hoja__pie">{pie}</div>}
      </div>
    </div>
  );
}
