import { useState } from 'preact/hooks';
import { useEstado } from '../../app/estado';
import { claveDe, metadatos, miniatura, type Cancion } from '../../core/musica/canciones';
import { leerEnlace, urlYoutubeMusic } from '../../core/musica/enlaces';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';
import { Miniatura } from './Miniatura';
import { Reproductor } from './Reproductor';
import { VideoOficial } from './VideoOficial';
import './PantallaMusica.css';

/**
 * Música: pegar un enlace de YouTube Music (o YouTube) y escucharlo en el reproductor oficial
 * incrustado, con los controles dibujados de la app encima. Las canciones quedan guardadas
 * (solo enlace y metadatos). Sin cuentas: YouTube Music no ofrece una API oficial para
 * conectarse a la cuenta de alguien, así que se usa lo que comparte su botón «Compartir».
 */
export function PantallaMusica() {
  const e = useEstado();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  async function anadir(ev?: Event) {
    ev?.preventDefault();
    const enlace = leerEnlace(texto);
    if (!enlace) {
      setError('Ese no parece un enlace de YouTube Music. Usa «Compartir → Copiar enlace» en la app.');
      return;
    }
    setError('');
    setBuscando(true);
    const datos = await metadatos(enlace);
    setBuscando(false);
    setTexto('');
    e.elegirCancion({
      clave: claveDe(enlace),
      enlace,
      titulo: datos?.titulo ?? (enlace.video ? 'Canción de YouTube' : 'Lista de YouTube Music'),
      artista: datos?.artista ?? '',
    });
  }

  const actual = e.cancion;
  return (
    <Pagina>
      <Encabezado
        titulo="Música"
        iconos={[{ icono: 'buscar', etiqueta: 'Buscar y comandos', alTocar: () => e.abrirComandos(true) }]}
      />

      <form class="musica__pegar" onSubmit={(ev) => void anadir(ev)}>
        <input
          class="musica__entrada"
          type="url"
          inputMode="url"
          enterKeyHint="go"
          aria-label="Enlace de YouTube Music"
          placeholder="Pega un enlace de YouTube Music"
          value={texto}
          onInput={(ev) => setTexto(ev.currentTarget.value)}
        />
        <Boton alTocar={() => void anadir()} desactivado={!texto.trim() || buscando}>
          {buscando ? 'Buscando…' : 'Añadir'}
        </Boton>
      </form>
      {error && (
        <p class="musica__error" role="alert">
          {error}
        </p>
      )}

      {actual ? (
        <Reproductor
          titulo={e.info.titulo ?? actual.titulo}
          artista={actual.artista}
          posicion={e.info.posicion}
          duracion={e.info.duracion}
          sonando={e.sonando}
          alAlternar={e.alternar}
          alAnterior={() => e.control.current?.anterior()}
          alSiguiente={() => e.control.current?.siguiente()}
          video={<VideoOficial key={actual.clave} enlace={actual.enlace} alCambiar={e.alCambiarVideo} control={e.control} />}
        />
      ) : (
        <EstadoVacio
          mensaje="Nada sonando."
          pista="En YouTube Music toca «Compartir → Copiar enlace» y pégalo arriba: canción, álbum o lista."
        />
      )}
      {actual && (
        <p class="musica__abrir">
          <a href={urlYoutubeMusic(actual.enlace)} target="_blank" rel="noopener noreferrer">
            Abrir en YouTube Music
          </a>
        </p>
      )}

      {e.canciones.length > 0 && (
        <section class="musica__guardadas" aria-label="Canciones guardadas">
          <h2 class="musica__subtitulo">Guardadas</h2>
          <ul class="musica__lista">
            {e.canciones.map((c: Cancion) => {
              return (
                <li key={c.clave} class={c.clave === actual?.clave ? 'musica__fila musica__fila--actual' : 'musica__fila'}>
                  <button type="button" class="musica__elegir" onClick={() => e.elegirCancion(c)}>
                    <Miniatura src={miniatura(c.enlace)} clase="musica__mini" />
                    <span class="musica__datos">
                      <span class="musica__titulo">{c.titulo}</span>
                      {c.artista && <span class="musica__artista">{c.artista}</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="musica__quitar"
                    aria-label={`Quitar «${c.titulo}»`}
                    onClick={() => e.quitarCancion(c.clave)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Pagina>
  );
}
