import type { ComponentChildren } from 'preact';
import type { Categoria } from './categorias';
import { Icono, type NombreIcono } from './Icono';
import './categorias.css';
import './Insignia.css';

export type TonoInsignia = 'neutro' | 'primario' | 'exito' | 'aviso' | 'peligro' | 'info' | Categoria;

interface Props {
  children: ComponentChildren;
  tono?: TonoInsignia | undefined;
  icono?: NombreIcono | undefined;
}

const SEMANTICOS = new Set(['neutro', 'primario', 'exito', 'aviso', 'peligro', 'info']);

/** Insignia de estado (no se toca): «Agotado», «Bajo», «Pagada»… Fondo suave + tinta legible. */
export function Insignia({ children, tono = 'neutro', icono }: Props) {
  const clase = SEMANTICOS.has(tono) ? `insignia--${tono}` : `cat-${tono}`;
  return (
    <span class={`insignia ${clase}`}>
      {icono && <Icono nombre={icono} tamano={16} />}
      {children}
    </span>
  );
}
