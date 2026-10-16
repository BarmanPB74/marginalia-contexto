import type { ComponentChildren } from 'preact';
import { useId, useRef } from 'preact/hooks';
import './Pestanas.css';

export interface Pestana<T extends string> {
  id: T;
  etiqueta: string;
  /** Número a la derecha (pendientes, resultados) */
  contador?: number | undefined;
}

interface Props<T extends string> {
  etiqueta: string;
  pestanas: readonly Pestana<T>[];
  actual: T;
  alCambiar: (id: T) => void;
  /** Contenido de la pestaña actual */
  children?: ComponentChildren | undefined;
}

/** Pestañas (tablist): flechas, Inicio y Fin para moverse; la lista se desplaza de lado si no cabe. */
export function Pestanas<T extends string>({ etiqueta, pestanas, actual, alCambiar, children }: Props<T>) {
  const base = useId();
  const lista = useRef<HTMLDivElement>(null);
  const ir = (i: number) => {
    const p = pestanas[(i + pestanas.length) % pestanas.length];
    if (!p) return;
    alCambiar(p.id);
    lista.current?.querySelector<HTMLElement>(`#${CSS.escape(`${base}-${p.id}`)}`)?.focus();
  };
  const alTeclear = (e: KeyboardEvent, i: number) => {
    const mapa: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: pestanas.length - 1 };
    const destino = mapa[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    ir(destino);
  };
  return (
    <div class="pestanas">
      <div ref={lista} class="pestanas__lista" role="tablist" aria-label={etiqueta}>
        {pestanas.map((p, i) => (
          <button
            key={p.id}
            id={`${base}-${p.id}`}
            type="button"
            role="tab"
            class="pestanas__pestana"
            aria-selected={p.id === actual}
            aria-controls={`${base}-panel`}
            tabIndex={p.id === actual ? 0 : -1}
            onClick={() => alCambiar(p.id)}
            onKeyDown={(e) => alTeclear(e, i)}
          >
            {p.etiqueta}
            {p.contador !== undefined && <span class="pestanas__contador cifras">{p.contador}</span>}
          </button>
        ))}
      </div>
      {children !== undefined && (
        <div id={`${base}-panel`} class="pestanas__panel" role="tabpanel" aria-labelledby={`${base}-${actual}`} tabIndex={0}>
          {children}
        </div>
      )}
    </div>
  );
}
