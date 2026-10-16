import type { ComponentChildren } from 'preact';
import './Tarjeta.css';

interface Props {
  children: ComponentChildren;
  /** elevada: se levanta del fondo (por defecto) · hundida: zona de entrada o resumen · plana: sin sombra */
  variante?: 'elevada' | 'hundida' | 'plana' | undefined;
}

/** Contenedor de bloque: esquinas generosas y sombra suave de dos capas. */
export function Tarjeta({ children, variante = 'elevada' }: Props) {
  return <div class={`tarjeta tarjeta--${variante}`}>{children}</div>;
}
