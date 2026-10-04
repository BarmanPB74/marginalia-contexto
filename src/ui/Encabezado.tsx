import { Boton } from './Boton';
import './Encabezado.css';

interface Accion {
  etiqueta: string;
  alTocar: () => void;
}

/** Título manuscrito de la pantalla + como mucho una acción (DISENO.md). */
export function Encabezado({ titulo, accion }: { titulo: string; accion?: Accion }) {
  return (
    <header class="encabezado">
      <h1 class="encabezado__titulo">{titulo}</h1>
      {accion && (
        <Boton variante="texto" alTocar={accion.alTocar}>
          {accion.etiqueta}
        </Boton>
      )}
    </header>
  );
}
