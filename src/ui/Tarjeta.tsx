import type { ComponentChildren } from 'preact';
import './Tarjeta.css';

/** Contenedor con contorno dibujado: sin relleno ni sombra. */
export function Tarjeta({ children }: { children: ComponentChildren }) {
  return <div class="tarjeta">{children}</div>;
}
