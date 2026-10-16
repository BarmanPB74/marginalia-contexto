import { useId } from 'preact/hooks';
import '../../ui/CampoTexto.css';

interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props {
  etiqueta: string;
  valor: string;
  opciones: readonly Opcion[];
  alCambiar: (valor: string) => void;
  ayuda?: string | undefined;
}

/**
 * Lista desplegable nativa con el aspecto de los campos (CampoTexto). Nativa a propósito: en
 * Android abre el selector del sistema, grande y accesible, y crece con la letra del sistema.
 */
export function Selector({ etiqueta, valor, opciones, alCambiar, ayuda }: Props) {
  const id = useId();
  return (
    <div class="campo">
      <label class="campo__etiqueta" for={id}>
        {etiqueta}
      </label>
      <select
        id={id}
        class="campo__entrada"
        value={valor}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        onChange={(e) => alCambiar(e.currentTarget.value)}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      {ayuda && (
        <p id={`${id}-ayuda`} class="campo__nota">
          {ayuda}
        </p>
      )}
    </div>
  );
}

/** Texto largo (notas) con el aspecto de los campos. */
export function CampoNota({ etiqueta, valor, alCambiar, marcador }: { etiqueta: string; valor: string; alCambiar: (v: string) => void; marcador?: string }) {
  const id = useId();
  return (
    <div class="campo">
      <label class="campo__etiqueta" for={id}>
        {etiqueta}
      </label>
      <textarea
        id={id}
        class="campo__entrada"
        rows={2}
        maxLength={500}
        value={valor}
        placeholder={marcador}
        onInput={(e) => alCambiar(e.currentTarget.value)}
      />
    </div>
  );
}
