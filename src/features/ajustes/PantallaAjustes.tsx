import { useEstado } from '../../app/estado';
import { Encabezado } from '../../ui/Encabezado';
import { Interruptor } from '../../ui/Interruptor';
import { Pagina } from '../../ui/Pagina';
import './PantallaAjustes.css';

/** Lista plana, sin tarjetas (DISENO.md). */
export function PantallaAjustes() {
  const { flotante, setFlotante } = useEstado();
  return (
    <Pagina>
      <Encabezado titulo="Ajustes" />
      <ul class="ajustes">
        <li>
          <Interruptor etiqueta="Reproductor flotante" activo={flotante} alCambiar={setFlotante} />
          <p class="ajustes__pista">Arrástralo por el asa a cualquier lugar de la pantalla.</p>
        </li>
      </ul>
    </Pagina>
  );
}
