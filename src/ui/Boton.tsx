import type { ComponentChildren } from 'preact';
import './Boton.css';

interface Props {
  children: ComponentChildren;
  /** contorno: acción principal dibujada · texto: acción secundaria, sin borde */
  variante?: 'contorno' | 'texto';
  alTocar?: () => void;
  desactivado?: boolean;
}

export function Boton({ children, variante = 'contorno', alTocar, desactivado = false }: Props) {
  return (
    <button type="button" class={`boton boton--${variante}`} onClick={alTocar} disabled={desactivado}>
      {children}
    </button>
  );
}
