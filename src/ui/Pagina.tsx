import type { ComponentChildren } from 'preact';
import './Pagina.css';

/** Lienzo de papel de cada pantalla. Una sola por vista. */
export function Pagina({ children }: { children: ComponentChildren }) {
  return <main class="pagina">{children}</main>;
}
