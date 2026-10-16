import { Icono, type NombreIcono } from './Icono';
import './BotonFlotante.css';

interface Props {
  /** Nombre de la acción ("Nuevo producto"); visible si es extendido */
  etiqueta: string;
  icono?: NombreIcono | undefined;
  alTocar: () => void;
  /** Muestra el texto junto al icono */
  extendido?: boolean | undefined;
  /** false: se dibuja en su sitio (catálogo); true: fijo abajo a la derecha, sobre la barra */
  fijo?: boolean | undefined;
}

/** Acción principal de una pantalla (una sola). Respeta la barra inferior, el riel y los bordes. */
export function BotonFlotante({ etiqueta, icono = 'mas-signo', alTocar, extendido = false, fijo = true }: Props) {
  return (
    <button
      type="button"
      class={`boton-flotante${extendido ? ' boton-flotante--extendido' : ''}${fijo ? ' boton-flotante--fijo' : ''}`}
      aria-label={extendido ? undefined : etiqueta}
      onClick={alTocar}
    >
      <Icono nombre={icono} tamano={26} />
      {extendido && <span class="boton-flotante__texto">{etiqueta}</span>}
    </button>
  );
}
