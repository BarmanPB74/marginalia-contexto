import { PLANTILLAS } from '../../core/notas/plantillas';
import { Boton } from '../../ui/Boton';
import { Tarjeta } from '../../ui/Tarjeta';
import './SelectorPlantilla.css';

interface Props {
  titulo: string;
  alElegir: (plantilla: string) => void;
  alCancelar: () => void;
}

/** Lista corta de plantillas para crear una nota. */
export function SelectorPlantilla({ titulo, alElegir, alCancelar }: Props) {
  return (
    <section class="selector-plantilla" aria-label={titulo}>
      <Tarjeta>
        <p class="selector-plantilla__titulo">{titulo}</p>
        <ul class="selector-plantilla__lista">
          {PLANTILLAS.map((p) => (
            <li key={p.id}>
              <Boton variante="texto" alTocar={() => alElegir(p.id)}>
                {p.nombre}
              </Boton>
            </li>
          ))}
        </ul>
        <div class="selector-plantilla__pie">
          <Boton variante="texto" alTocar={alCancelar}>
            Cancelar
          </Boton>
        </div>
      </Tarjeta>
    </section>
  );
}
