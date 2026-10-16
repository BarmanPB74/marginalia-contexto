import { useId, useRef } from 'preact/hooks';
import { Icono } from './Icono';
import './CampoTexto.css';
import './Buscador.css';

interface Props {
  /** Nombre accesible ("Buscar productos"); se muestra como marcador si no hay otro */
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  marcador?: string | undefined;
  /** Intro del teclado */
  alBuscar?: (() => void) | undefined;
}

/** Campo de búsqueda con lupa y botón para borrar. Dentro de un landmark `search`. */
export function Buscador({ etiqueta, valor, alCambiar, marcador, alBuscar }: Props) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div class="buscador" role="search">
      <label class="solo-lector" for={id}>
        {etiqueta}
      </label>
      <span class="campo__caja buscador__caja">
        <Icono nombre="buscar" tamano={22} />
        <input
          ref={entrada}
          id={id}
          class="buscador__entrada"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={valor}
          placeholder={marcador ?? etiqueta}
          onInput={(e) => alCambiar(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && alBuscar?.()}
        />
        {valor && (
          <button
            type="button"
            class="buscador__borrar"
            aria-label="Borrar búsqueda"
            onClick={() => {
              alCambiar('');
              entrada.current?.focus();
            }}
          >
            <Icono nombre="cerrar" tamano={20} />
          </button>
        )}
      </span>
    </div>
  );
}
