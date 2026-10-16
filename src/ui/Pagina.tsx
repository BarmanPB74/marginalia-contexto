import type { ComponentChildren } from 'preact';
import './Pagina.css';

interface Props {
  children: ComponentChildren;
  /** lectura: columna cómoda para leer (Bitácora) · amplio: hasta 1280 px, para rejillas y tablas */
  ancho?: 'lectura' | 'amplio' | undefined;
}

/** Lienzo de cada pantalla (el <main>). Una sola por vista. Deja sitio a la barra o al riel. */
export function Pagina({ children, ancho = 'lectura' }: Props) {
  return <main class={`pagina pagina--${ancho}`}>{children}</main>;
}
