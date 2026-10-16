import type { ComponentChildren } from 'preact';
import type { Categoria } from './categorias';
import { Icono } from './Icono';
import './categorias.css';
import './Chip.css';

interface PropsChip {
  children: ComponentChildren;
  /** Elegido (aria-pressed). Para elegir una sola opción de un grupo, combina varios Chip. */
  seleccionado: boolean;
  alCambiar: (seleccionado: boolean) => void;
  /** Contador opcional a la derecha ("(45)") */
  contador?: number | undefined;
  color?: Categoria | undefined;
  desactivado?: boolean | undefined;
}

/** Chip seleccionable (tallas, valoraciones, categorías): un botón conmutador en forma de píldora. */
export function Chip({ children, seleccionado, alCambiar, contador, color, desactivado = false }: PropsChip) {
  return (
    <button
      type="button"
      class={`chip${color ? ` cat-${color}` : ''}`}
      aria-pressed={seleccionado}
      disabled={desactivado}
      onClick={() => alCambiar(!seleccionado)}
    >
      {seleccionado && <Icono nombre="check" tamano={18} />}
      <span class="chip__texto">{children}</span>
      {contador !== undefined && <span class="chip__contador cifras">{contador}</span>}
    </button>
  );
}

interface PropsChipFiltro {
  /** Texto visible del filtro activo ("Café", "Hasta $ 10.000") */
  children: string;
  alQuitar: () => void;
}

/** Filtro activo con ×: todo el chip lo quita (objetivo táctil grande) y se anuncia como tal. */
export function ChipFiltro({ children, alQuitar }: PropsChipFiltro) {
  return (
    <button type="button" class="chip chip--filtro" aria-label={`Quitar filtro: ${children}`} onClick={alQuitar}>
      <span class="chip__texto">{children}</span>
      <Icono nombre="cerrar" tamano={18} />
    </button>
  );
}

/** Fila de chips que se envuelve (nunca desborda de lado). */
export function GrupoChips({ etiqueta, children }: { etiqueta: string; children: ComponentChildren }) {
  return (
    <div class="grupo-chips" role="group" aria-label={etiqueta}>
      {children}
    </div>
  );
}
