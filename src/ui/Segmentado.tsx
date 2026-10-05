import './Segmentado.css';

interface Opcion<T extends string> {
  valor: T;
  etiqueta: string;
}

interface Props<T extends string> {
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
}

/** Elegir una de pocas opciones (2–4): botones pegados, el elegido con fondo de acento. */
export function Segmentado<T extends string>({ etiqueta, opciones, valor, alCambiar }: Props<T>) {
  return (
    <div class="segmentado" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          class="segmentado__opcion"
          onClick={() => alCambiar(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
