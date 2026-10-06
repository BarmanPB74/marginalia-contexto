import { Boton } from './Boton';
import { Icono, type NombreIcono } from './Icono';
import './Encabezado.css';

interface Accion {
  etiqueta: string;
  alTocar: () => void;
}

interface AccionIcono {
  icono: NombreIcono;
  etiqueta: string;
  alTocar: () => void;
  activo?: boolean;
}

/** Título manuscrito de la pantalla + una acción de texto y, si hace falta, pocos iconos (DISENO.md). */
export function Encabezado({ titulo, accion, iconos = [] }: { titulo: string; accion?: Accion; iconos?: AccionIcono[] }) {
  return (
    <header class="encabezado">
      <h1 class="encabezado__titulo">{titulo}</h1>
      <span class="encabezado__acciones">
        {iconos.map((i) => (
          <button
            key={i.etiqueta}
            type="button"
            class="encabezado__icono"
            aria-label={i.etiqueta}
            aria-pressed={i.activo}
            title={i.etiqueta}
            onClick={i.alTocar}
          >
            <Icono nombre={i.icono} />
          </button>
        ))}
        {accion && (
          <Boton variante="texto" alTocar={accion.alTocar}>
            {accion.etiqueta}
          </Boton>
        )}
      </span>
    </header>
  );
}
