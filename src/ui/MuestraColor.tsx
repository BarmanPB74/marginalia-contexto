import { useRef } from 'preact/hooks';
import type { Categoria } from './categorias';
import { Icono } from './Icono';
import './categorias.css';
import './MuestraColor.css';

export interface OpcionColor<T extends string> {
  valor: T;
  nombre: string;
  /** Color de la paleta, o neutros para negro y blanco */
  color: Categoria | 'oscuro' | 'claro';
}

interface Props<T extends string> {
  etiqueta: string;
  opciones: readonly OpcionColor<T>[];
  /** null: ninguno elegido */
  valor: T | null;
  alCambiar: (valor: T) => void;
}

/** Muestras de color redondas con su nombre debajo. Grupo de radio: flechas para moverse. */
export function MuestraColor<T extends string>({ etiqueta, opciones, valor, alCambiar }: Props<T>) {
  const grupo = useRef<HTMLDivElement>(null);
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor));
  const mover = (e: KeyboardEvent, i: number) => {
    const pasos: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const paso = pasos[e.key];
    if (!paso) return;
    e.preventDefault();
    const siguiente = (i + paso + opciones.length) % opciones.length;
    const opcion = opciones[siguiente];
    if (!opcion) return;
    alCambiar(opcion.valor);
    grupo.current?.querySelectorAll<HTMLElement>('[role="radio"]')[siguiente]?.focus();
  };
  return (
    <div ref={grupo} class="muestras" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o, i) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          tabIndex={i === indice ? 0 : -1}
          class={`muestra-color muestra-color--${o.color}${o.color === 'oscuro' || o.color === 'claro' ? '' : ` cat-${o.color}`}`}
          onClick={() => alCambiar(o.valor)}
          onKeyDown={(e) => mover(e, i)}
        >
          <span class="muestra-color__circulo" aria-hidden="true">
            {o.valor === valor && <Icono nombre="check" tamano={18} />}
          </span>
          <span class="muestra-color__nombre">{o.nombre}</span>
        </button>
      ))}
    </div>
  );
}
