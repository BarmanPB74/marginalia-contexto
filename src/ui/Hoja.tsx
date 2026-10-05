import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import './Hoja.css';

interface Props {
  titulo: string;
  alCerrar: () => void;
  children: ComponentChildren;
}

/**
 * Hoja inferior (DISENO.md: "tocar el día abre una hoja inferior"). Sube desde abajo sobre un velo;
 * se cierra tocando el velo, con Escape o con el botón atrás del teclado.
 */
export function Hoja({ titulo, alCerrar, children }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    addEventListener('keydown', alTeclear);
    return () => removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  return (
    <div class="hoja">
      <div class="hoja__velo" onClick={alCerrar} aria-hidden="true" />
      <div ref={panel} class="hoja__panel" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}>
        <span class="hoja__asa" aria-hidden="true" />
        <p class="hoja__titulo">{titulo}</p>
        {children}
      </div>
    </div>
  );
}
