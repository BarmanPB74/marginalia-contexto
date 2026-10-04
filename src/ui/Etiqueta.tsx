import type { ComponentChildren } from 'preact';
import './Etiqueta.css';

interface Props {
  children: ComponentChildren;
  /** cancion: tinta azul (acento) · fecha y normal: tinta */
  tipo?: 'normal' | 'cancion' | 'fecha';
}

/** Píldora de trazo. Solo muestra; tocarla (abrir canción o día) llega en F3/F4. */
export function Etiqueta({ children, tipo = 'normal' }: Props) {
  return <span class={`etiqueta etiqueta--${tipo}`}>{children}</span>;
}
