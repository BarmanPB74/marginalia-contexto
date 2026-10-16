import { useEffect, useRef } from 'preact/hooks';
import { Icono } from './Icono';
import './Casilla.css';

interface Props {
  etiqueta: string;
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  /** Número de resultados entre paréntesis ("Café (45)") */
  contador?: number | undefined;
  /** Parcialmente marcada (p. ej. «todas» cuando solo hay algunas) */
  indeterminada?: boolean | undefined;
  desactivada?: boolean | undefined;
}

/** Casilla de verificación con etiqueta: la fila entera es tocable (≥ 48 px). Input nativo, accesible. */
export function Casilla({ etiqueta, marcada, alCambiar, contador, indeterminada = false, desactivada = false }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (entrada.current) entrada.current.indeterminate = indeterminada;
  }, [indeterminada]);
  return (
    <label class={`casilla${desactivada ? ' casilla--desactivada' : ''}`}>
      <input
        ref={entrada}
        class="casilla__entrada"
        type="checkbox"
        checked={marcada}
        disabled={desactivada}
        onChange={(e) => alCambiar(e.currentTarget.checked)}
      />
      <span class="casilla__caja" aria-hidden="true">
        <Icono nombre={indeterminada ? 'menos' : 'check'} tamano={18} />
      </span>
      <span class="casilla__texto">
        {etiqueta}
        {contador !== undefined && <span class="casilla__contador cifras"> ({contador})</span>}
      </span>
    </label>
  );
}
