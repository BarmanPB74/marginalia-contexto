import { useState } from 'preact/hooks';
import { useEstado } from '../../app/estado';
import type { Tema, VistaNotas } from '../../app/ajustes';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Encabezado } from '../../ui/Encabezado';
import { Interruptor } from '../../ui/Interruptor';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { useRepositorio } from '../notas/contexto';
import { elegirZip, exportarCopia, importarCopia } from '../notas/copia';
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
  const { flotante, setFlotante, tema, vistaNotas, miniEscondido, cambiarAjustes, abrirComandos, spotifyClientId } =
    useEstado();
  // Se guarda solo cuando es válido (o vacío, para quitarlo)
  const [clientId, setClientId] = useState(spotifyClientId);
  const clientIdValido = /^[0-9a-f]{32}$/.test(clientId.trim().toLowerCase());
  const repo = useRepositorio();
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function trabajar(tarea: () => Promise<string>) {
    setOcupado(true);
    setAviso('');
    try {
      setAviso(await tarea());
    } catch {
      setAviso('No se pudo completar. En Android 10 o anterior, la carpeta Documentos necesita un permiso que la app no pide.');
    } finally {
      setOcupado(false);
    }
  }
  return (
    <Pagina>
      <Encabezado
        titulo="Ajustes"
        iconos={[{ icono: 'buscar', etiqueta: 'Buscar y comandos', alTocar: () => abrirComandos(true) }]}
      />
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
          <p class="ajustes__titulo">Spotify</p>
          <CampoTexto
            etiqueta="Client ID de tu app de Spotify"
            marcador="32 letras y números"
            valor={clientId}
            alCambiar={(v) => {
              setClientId(v);
              const limpio = v.trim().toLowerCase();
              if (!limpio || /^[0-9a-f]{32}$/.test(limpio)) cambiarAjustes({ spotifyClientId: limpio });
            }}
          />
          {clientId.trim() && !clientIdValido && (
            <p class="ajustes__aviso" role="alert">
              Ese Client ID no es válido: cópialo tal cual del Dashboard de Spotify.
            </p>
          )}
          <p class="ajustes__pista">
            Spotify suena en su propia app, también en segundo plano. Necesitas Premium y registrar tu app en el
            Dashboard de Spotify (pasos en docs/LEGAL.md). El Client ID no es secreto y se queda en este teléfono.
          </p>
        </li>
        <li>
          <p class="ajustes__titulo">Copia de seguridad</p>
          <div class="ajustes__botones">
            <Boton desactivado={ocupado} alTocar={() => void trabajar(() => exportarCopia(repo))}>
              Exportar notas (ZIP)
            </Boton>
            <Boton
              variante="texto"
              desactivado={ocupado}
              alTocar={() => {
                // El selector se abre ya, dentro del toque. Mientras se elige no se bloquea nada:
                // si el sistema no avisa de "cancelar", los botones no se quedan desactivados.
                void elegirZip().then((archivo) => archivo && trabajar(() => importarCopia(repo, archivo)));
              }}
            >
              Importar notas (ZIP)
            </Boton>
          </div>
          <p class="ajustes__pista">
            Todas tus notas en un .zip de Markdown legible (sin cifrar). Importar nunca borra ni pisa lo que ya tienes.
          </p>
          {aviso && (
            <p class="ajustes__aviso" aria-live="polite">
              {aviso}
            </p>
          )}
        </li>
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
