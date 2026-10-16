import { useId } from 'preact/hooks';
import './CampoTexto.css';

interface Props {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  marcador?: string;
  /** Texto de ayuda bajo el campo */
  ayuda?: string;
  /** Mensaje de error: marca el campo como inválido y se anuncia */
  error?: string;
  /** Tipo de teclado: text (por defecto), email, tel, search */
  tipo?: 'text' | 'email' | 'tel' | 'search';
  /** Etiqueta solo para lectores de pantalla (cuando el contexto ya la muestra) */
  ocultarEtiqueta?: boolean;
}

/** Campo de una línea: etiqueta arriba y caja hundida en el panel. */
export function CampoTexto({ etiqueta, valor, alCambiar, marcador, ayuda, error, tipo = 'text', ocultarEtiqueta = false }: Props) {
  const id = useId();
  const idNota = `${id}-nota`;
  const nota = error ?? ayuda;
  return (
    <div class={`campo${error ? ' campo--error' : ''}`}>
      <label class={ocultarEtiqueta ? 'solo-lector' : 'campo__etiqueta'} for={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        class="campo__entrada"
        type={tipo}
        value={valor}
        placeholder={marcador}
        aria-invalid={error ? true : undefined}
        aria-describedby={nota ? idNota : undefined}
        onInput={(e) => alCambiar(e.currentTarget.value)}
      />
      {nota && (
        <p id={idNota} class="campo__nota" role={error ? 'alert' : undefined}>
          {nota}
        </p>
      )}
    </div>
  );
}
