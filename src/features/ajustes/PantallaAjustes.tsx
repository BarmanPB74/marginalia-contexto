import { useEstado } from '../../app/estado';
import type { Tema, VistaNotas } from '../../app/ajustes';
import { Encabezado } from '../../ui/Encabezado';
import { Interruptor } from '../../ui/Interruptor';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import './PantallaAjustes.css';

const TEMAS: { valor: Tema; etiqueta: string }[] = [
  { valor: 'sistema', etiqueta: 'Sistema' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
];

const VISTAS: { valor: VistaNotas; etiqueta: string }[] = [
  { valor: 'tarjetas', etiqueta: 'Tarjetas' },
  { valor: 'lista', etiqueta: 'Lista' },
];

/** Lista plana, sin tarjetas (DISENO.md). */
export function PantallaAjustes() {
  const { flotante, setFlotante, tema, vistaNotas, miniEscondido, cambiarAjustes } = useEstado();
  return (
    <Pagina>
      <Encabezado titulo="Ajustes" />
      <ul class="ajustes">
        <li>
          <p class="ajustes__titulo">
            Tema
          </p>
          <Segmentado etiqueta="Tema" opciones={TEMAS} valor={tema} alCambiar={(t) => cambiarAjustes({ tema: t })} />
          <p class="ajustes__pista">«Sistema» cambia solo cuando el teléfono pasa a modo oscuro.</p>
        </li>
        <li>
          <p class="ajustes__titulo">Notas</p>
          <Segmentado
            etiqueta="Vista de notas"
            opciones={VISTAS}
            valor={vistaNotas}
            alCambiar={(v) => cambiarAjustes({ vistaNotas: v })}
          />
          <p class="ajustes__pista">Tarjetas: tus notas como las apps recientes de Android.</p>
        </li>
        <li>
          <Interruptor etiqueta="Reproductor flotante" activo={flotante} alCambiar={setFlotante} />
          <p class="ajustes__pista">
            Arrástralo por el asa a cualquier lugar; lánzalo contra un borde para esconderlo a un lado.
          </p>
        </li>
        {miniEscondido && (
          <li>
            <Interruptor
              etiqueta="Globo de música escondido"
              activo
              alCambiar={() => cambiarAjustes({ miniEscondido: null })}
            />
          </li>
        )}
        <li>
          <p class="ajustes__titulo">Privacidad</p>
          <p class="ajustes__pista ajustes__pista--suelta">
            Cada nota se cifra (AES-256-GCM) en cuanto se crea, con una clave que nunca sale de este teléfono.
            Al exportarla se guarda descifrada, en un formato que cualquier app puede leer.
          </p>
        </li>
      </ul>
    </Pagina>
  );
}
