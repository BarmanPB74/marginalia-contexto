import { useEffect, useId, useState } from 'preact/hooks';
import './CampoTexto.css';
import './Rango.css';

interface Props {
  etiqueta: string;
  min: number;
  max: number;
  paso?: number | undefined;
  valorMin: number;
  valorMax: number;
  alCambiar: (valorMin: number, valorMax: number) => void;
  /** Prefijo de los campos ("$") y sufijo ("kg") */
  prefijo?: string | undefined;
  sufijo?: string | undefined;
  /** Cómo leer un valor en voz alta ("$ 8.500"); por defecto, el número */
  formatear?: ((n: number) => string) | undefined;
}

const limitar = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

/** Campo de filtro numérico: solo dígitos; un texto vacío o raro deja el valor anterior. */
function CampoLimite(props: {
  etiqueta: string;
  valor: number;
  prefijo?: string | undefined;
  sufijo?: string | undefined;
  alConfirmar: (n: number) => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState(String(props.valor));
  useEffect(() => setTexto(String(props.valor)), [props.valor]);
  const confirmar = () => {
    const limpio = texto.replace(/\D/g, '');
    if (limpio === '') setTexto(String(props.valor));
    else props.alConfirmar(Number(limpio));
  };
  return (
    <div class="campo rango__campo">
      <label class="campo__etiqueta rango__etiqueta-campo" for={id}>
        {props.etiqueta}
      </label>
      <span class="campo__caja campo-numero__caja">
        {props.prefijo && <span class="campo-numero__afijo" aria-hidden="true">{props.prefijo}</span>}
        <input
          id={id}
          class="campo-numero__entrada cifras"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          value={texto}
          onInput={(e) => setTexto(e.currentTarget.value)}
          onBlur={confirmar}
          onKeyDown={(e) => e.key === 'Enter' && confirmar()}
        />
        {props.sufijo && <span class="campo-numero__afijo" aria-hidden="true">{props.sufijo}</span>}
      </span>
    </div>
  );
}

/**
 * Rango con dos manijas (mínimo y máximo) y sus campos numéricos. Son dos <input type=range>
 * superpuestos: cada manija es un control nativo con su nombre, flechas y lector de pantalla.
 */
export function Rango({ etiqueta, min, max, paso = 1, valorMin, valorMax, alCambiar, prefijo, sufijo, formatear = String }: Props) {
  const id = useId();
  const porcentaje = (n: number) => (max === min ? 0 : ((n - min) / (max - min)) * 100);
  const cambiarMin = (n: number) => alCambiar(limitar(n, min, valorMax), valorMax);
  const cambiarMax = (n: number) => alCambiar(valorMin, limitar(n, valorMin, max));
  return (
    <fieldset class="rango">
      <legend class="rango__leyenda" id={id}>
        {etiqueta}
      </legend>
      <div class="rango__campos">
        <CampoLimite etiqueta="Mín." valor={valorMin} prefijo={prefijo} sufijo={sufijo} alConfirmar={cambiarMin} />
        <CampoLimite etiqueta="Máx." valor={valorMax} prefijo={prefijo} sufijo={sufijo} alConfirmar={cambiarMax} />
      </div>
      <div
        class="rango__pista"
        style={{ '--desde': `${porcentaje(valorMin)}%`, '--hasta': `${porcentaje(valorMax)}%` }}
      >
        <input
          type="range"
          class="rango__manija"
          min={min}
          max={max}
          step={paso}
          value={valorMin}
          aria-label={`${etiqueta}: mínimo`}
          aria-valuetext={formatear(valorMin)}
          onInput={(e) => cambiarMin(Number(e.currentTarget.value))}
        />
        <input
          type="range"
          class="rango__manija"
          min={min}
          max={max}
          step={paso}
          value={valorMax}
          aria-label={`${etiqueta}: máximo`}
          aria-valuetext={formatear(valorMax)}
          onInput={(e) => cambiarMax(Number(e.currentTarget.value))}
        />
      </div>
    </fieldset>
  );
}
