import type { ComponentChildren } from 'preact';
import type { Categoria } from './categorias';
import './categorias.css';
import './Etiqueta.css';

interface Props {
  children: ComponentChildren;
  /** cancion: tinta de acento · fecha y normal: neutra */
  tipo?: 'normal' | 'cancion' | 'fecha';
  /** Color de categoría (fondo suave + su tinta) */
  color?: Categoria;
}

/** Píldora de solo lectura (etiquetas de nota, categorías). Para filtrar, usa Chip. */
export function Etiqueta({ children, tipo = 'normal', color }: Props) {
  return <span class={`etiqueta etiqueta--${tipo}${color ? ` cat-${color}` : ''}`}>{children}</span>;
}
