import { useId } from 'preact/hooks';
import './CampoTexto.css';

interface Props {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  marcador?: string;
}

/** Campo de una línea: solo una raya de lápiz debajo, como en un cuaderno. */
export function CampoTexto({ etiqueta, valor, alCambiar, marcador }: Props) {
  const id = useId();
  return (
    <div class="campo">
      <label class="campo__etiqueta" for={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        class="campo__entrada"
        type="text"
        value={valor}
        placeholder={marcador}
        onInput={(e) => alCambiar(e.currentTarget.value)}
      />
    </div>
  );
}
