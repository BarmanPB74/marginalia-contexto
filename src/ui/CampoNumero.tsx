import { useId } from 'preact/hooks';
import './CampoTexto.css';
import './CampoNumero.css';

interface Props {
  etiqueta: string;
  /** Texto tal cual lo escribe la persona: este componente NO convierte; el núcleo lo valida */
  valor: string;
  alCambiar: (texto: string) => void;
  /** "$" para dinero */
  prefijo?: string | undefined;
  /** Unidad: "kg", "und", "L" */
  sufijo?: string | undefined;
  marcador?: string | undefined;
  ayuda?: string | undefined;
  error?: string | undefined;
  desactivado?: boolean | undefined;
  /** Intro / «Listo» del teclado */
  alConfirmar?: (() => void) | undefined;
  /** Cifra grande (caja, cobrar) */
  grande?: boolean | undefined;
}

/** Campo de dinero o cantidad: teclado decimal, prefijo y sufijo visibles, cifras tabulares. */
export function CampoNumero({ etiqueta, valor, alCambiar, prefijo, sufijo, marcador, ayuda, error, desactivado = false, alConfirmar, grande = false }: Props) {
  const id = useId();
  const idNota = `${id}-nota`;
  const idAfijos = `${id}-afijos`;
  const nota = error ?? ayuda;
  const descritoPor = [nota && idNota, (prefijo || sufijo) && idAfijos].filter(Boolean).join(' ') || undefined;
  return (
    <div class={`campo campo-numero${error ? ' campo--error' : ''}${grande ? ' campo-numero--grande' : ''}`}>
      <label class="campo__etiqueta" for={id}>
        {etiqueta}
      </label>
      <span class="campo__caja campo-numero__caja">
        {prefijo && (
          <span class="campo-numero__afijo" aria-hidden="true">
            {prefijo}
          </span>
        )}
        <input
          id={id}
          class="campo-numero__entrada cifras"
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={valor}
          placeholder={marcador}
          disabled={desactivado}
          aria-invalid={error ? true : undefined}
          aria-describedby={descritoPor}
          onInput={(e) => alCambiar(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && alConfirmar?.()}
        />
        {sufijo && (
          <span class="campo-numero__afijo" aria-hidden="true">
            {sufijo}
          </span>
        )}
      </span>
      {(prefijo || sufijo) && (
        <span id={idAfijos} class="solo-lector">
          {[prefijo && `en ${prefijo === '$' ? 'pesos' : prefijo}`, sufijo && `en ${sufijo}`].filter(Boolean).join(', ')}
        </span>
      )}
      {nota && (
        <p id={idNota} class="campo__nota" role={error ? 'alert' : undefined}>
          {nota}
        </p>
      )}
    </div>
  );
}
