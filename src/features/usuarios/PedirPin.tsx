import { useState } from 'preact/hooks';
import { TecladoPin } from '../../ui/TecladoPin';
import { LARGO_PIN } from '../sesion/Sesion';

type Paso = 'actual' | 'nuevo' | 'repetir';

interface Props {
  /** Pedir primero el PIN actual (cambiar el propio) */
  conActual?: boolean | undefined;
  /** Para quién es el PIN nuevo («Crea el PIN de Carlos») */
  etiquetaNuevo: string;
  /** Recibe los PIN; devuelve un mensaje de error (o nada si salió bien) */
  alTerminar: (pines: { actual?: string; nuevo: string }) => Promise<string | undefined>;
  /** Acción de la esquina del teclado (volver al paso anterior o cancelar) */
  alVolver?: (() => void) | undefined;
}

/**
 * PIN nuevo con el teclado grande, escrito dos veces (y antes el actual, si es el propio).
 * Los dígitos nunca se muestran ni se guardan fuera de este componente.
 */
export function PedirPin({ conActual = false, etiquetaNuevo, alTerminar, alVolver }: Props) {
  const inicio: Paso = conActual ? 'actual' : 'nuevo';
  const [paso, setPaso] = useState<Paso>(inicio);
  const [valor, setValor] = useState('');
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  const etiqueta =
    paso === 'actual' ? 'Escribe tu PIN actual' : paso === 'nuevo' ? etiquetaNuevo : `Repite el PIN nuevo (${LARGO_PIN} dígitos)`;

  async function terminar(repetido: string) {
    if (repetido !== nuevo) {
      setError('No coinciden. Escribe el PIN nuevo otra vez.');
      setNuevo('');
      setPaso('nuevo');
      return;
    }
    setOcupado(true);
    const mensaje = await alTerminar(conActual ? { actual, nuevo: repetido } : { nuevo: repetido });
    setOcupado(false);
    if (mensaje) {
      setError(mensaje);
      setActual('');
      setNuevo('');
      setPaso(inicio);
    }
  }

  return (
    <TecladoPin
      key={paso}
      valor={valor}
      alCambiar={(v) => {
        setValor(v);
        setError(undefined);
      }}
      longitud={LARGO_PIN}
      etiqueta={etiqueta}
      error={error}
      desactivado={ocupado}
      accion={alVolver ? { etiqueta: 'Volver', icono: 'atras', alTocar: alVolver } : undefined}
      alCompletar={(v) => {
        setValor('');
        if (paso === 'actual') {
          setActual(v);
          setPaso('nuevo');
        } else if (paso === 'nuevo') {
          setNuevo(v);
          setPaso('repetir');
        } else void terminar(v);
      }}
    />
  );
}
