import { useEffect, useState } from 'preact/hooks';
import { cancionDeNota, idDe, minutoSegundo, rutaCancion } from '../../core/musica/etiqueta';
import type { Nota } from '../../core/notas/nota';
import { useEstado } from '../../app/estado';
import { claveDe, metadatos, miniatura, type Cancion } from '../../core/musica/canciones';
import { leerEnlace, urlYoutubeMusic } from '../../core/musica/enlaces';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';
import { Miniatura } from './Miniatura';
import { Reproductor } from './Reproductor';
import { useRepositorio } from '../notas/contexto';
import { ID_HUECO } from './CapaVideo';
import { PanelSpotify } from './PanelSpotify';
import { Segmentado } from '../../ui/Segmentado';
import type { Fuente } from '../../app/ajustes';
import type { cancionEnRuta } from '../../app/rutas';
import './PantallaMusica.css';

/**
 * Música: pegar un enlace de YouTube Music (o YouTube) y escucharlo en el reproductor oficial
 * incrustado, con los controles dibujados de la app encima. Las canciones quedan guardadas
 * (solo enlace y metadatos). Sin cuentas: YouTube Music no ofrece una API oficial para
 * conectarse a la cuenta de alguien, así que se usa lo que comparte su botón «Compartir».
 * Con la fuente «Spotify» (ADR-013) se controla la app de Spotify, que suena en segundo plano.
 */
const FUENTES: { valor: Fuente; etiqueta: string }[] = [
  { valor: 'youtube', etiqueta: 'YouTube Music' },
  { valor: 'spotify', etiqueta: 'Spotify' },
];

export function PantallaMusica({ pedida = null }: { pedida?: ReturnType<typeof cancionEnRuta> }) {
  const e = useEstado();
  const repo = useRepositorio();

  // Una etiqueta ♪ de una nota pide esta canción desde este segundo (historia 5)
  useEffect(() => {
    if (!pedida) return;
    if (pedida.spotify) {
      e.ponerSpotify(pedida.spotify, pedida.t);
      location.replace('#/musica');
      return;
    }
    if (!pedida.yt) return;
    e.cambiarAjustes({ fuente: 'youtube' });
    const guardada = e.canciones.find((c) => c.clave === pedida.yt);
    const cancion: Cancion = guardada ?? {
      clave: pedida.yt,
      enlace: { video: pedida.yt },
      titulo: 'Canción de YouTube',
      artista: '',
    };
    e.elegirCancion(cancion, pedida.t);
    // Que «atrás» o recargar no la vuelvan a pedir
    location.replace('#/musica');
    if (!guardada) {
      const yt = pedida.yt;
      void metadatos({ video: yt }).then((datos) => datos && e.datosCancion(yt, datos));
    }
    // Solo cuando cambia lo pedido
  }, [pedida?.yt, pedida?.spotify, pedida?.t]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [conCancion, setConCancion] = useState<Nota[]>([]);

  // «Las notas con ♪ canción aparecen aquí»: las que tienen canción principal, la última editada primero
  useEffect(() => {
    let vigente = true;
    repo.listar().then(
      ({ notas }) =>
        vigente &&
        setConCancion(notas.filter((n) => cancionDeNota(n)).sort((a, b) => (a.editado < b.editado ? 1 : -1))),
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [repo]);

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
  const [enLinea, setEnLinea] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const cambiar = () => setEnLinea(navigator.onLine !== false);
    addEventListener('online', cambiar);
    addEventListener('offline', cambiar);
    return () => {
      removeEventListener('online', cambiar);
      removeEventListener('offline', cambiar);
    };
  }, []);

  /** Historia 4: mientras suena, una nota que guarda la canción y el segundo exacto. */
  async function notaConCancion() {
    if (!actual?.enlace.video) return;
    const nota = await repo.crear({
      plantilla: 'rapida',
      cancion: {
        yt: actual.enlace.video,
        titulo: e.info.titulo ?? actual.titulo,
        ...(actual.artista ? { artista: actual.artista } : {}),
        t: Math.floor(e.info.posicion),
      },
    });
    location.hash = `#/notas/${nota.id}`;
  }

  /** Lo mismo con Spotify: la URI y el segundo en que iba. */
  async function notaConSpotify(uri: string, segundo: number) {
    const estado = e.spotify.estado;
    const nota = await repo.crear({
      plantilla: 'rapida',
      cancion: {
        spotify: uri,
        ...(estado?.titulo ? { titulo: estado.titulo } : {}),
        ...(estado?.artista ? { artista: estado.artista } : {}),
        t: segundo,
      },
    });
    location.hash = `#/notas/${nota.id}`;
  }

  function cambiarFuente(fuente: Fuente) {
    // Una sola música a la vez
    if (fuente === 'spotify') {
      e.control.current?.pausar();
      e.alCambiarVideo({ sonando: false });
    } else e.spotify.pausar();
    e.cambiarAjustes({ fuente });
  }
  return (
    <Pagina>
      <Encabezado
        titulo="Música"
        iconos={[{ icono: 'buscar', etiqueta: 'Buscar y comandos', alTocar: () => e.abrirComandos(true) }]}
      />

      <div class="musica__fuente">
        <Segmentado etiqueta="Fuente de música" opciones={FUENTES} valor={e.fuente} alCambiar={cambiarFuente} />
      </div>

      {e.fuente === 'spotify' ? (
        <PanelSpotify alNotaConCancion={(uri, segundo) => void notaConSpotify(uri, segundo)} />
      ) : (
      <>
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
          // El reproductor oficial vive en la raíz de la app (CapaVideo) y se coloca sobre este hueco
          video={<div id={ID_HUECO} class="video-oficial" />}
        />
      ) : (
        <EstadoVacio
          mensaje="Nada sonando."
          pista="En YouTube Music toca «Compartir → Copiar enlace» y pégalo arriba: canción, álbum o lista."
        />
      )}
      {actual && !enLinea && (
        <p class="musica__error" role="alert">
          Sin conexión: el reproductor de YouTube necesita internet. Tus notas y canciones guardadas siguen aquí.
        </p>
      )}
      {actual && e.info.error !== undefined && (
        <p class="musica__error" role="alert">
          {e.info.error === 101 || e.info.error === 150
            ? 'Quien la publicó no deja reproducirla fuera de YouTube. Ábrela en YouTube Music.'
            : e.info.error === 100
              ? 'Esta canción ya no está disponible (borrada o privada).'
              : 'El reproductor no pudo cargarla. Prueba de nuevo o ábrela en YouTube Music.'}
        </p>
      )}
      {actual?.enlace.video && (
        <div class="musica__acciones">
          <Boton alTocar={() => void notaConCancion()}>♪ Nueva nota con esta canción</Boton>
        </div>
      )}
      {actual && (
        <p class="musica__abrir">
          <a href={urlYoutubeMusic(actual.enlace)} target="_blank" rel="noopener noreferrer">
            Abrir en YouTube Music
          </a>
        </p>
      )}
      </>
      )}

      {conCancion.length > 0 && (
        <section class="musica__guardadas" aria-label="Notas con canción">
          <h2 class="musica__subtitulo">Notas con canción</h2>
          <ul class="musica__lista">
            {conCancion.map((n) => {
              const c = cancionDeNota(n);
              if (!c) return null;
              return (
                <li key={n.id} class="musica__fila">
                  <a class="musica__elegir" href={`#/notas/${n.id}`}>
                    <span class="musica__datos">
                      <span class="musica__titulo">{n.titulo}</span>
                      <span class="musica__artista">
                        ♪ {c.titulo ?? 'Canción'}
                        {c.t !== undefined ? ` · ${minutoSegundo(c.t)}` : ''}
                      </span>
                    </span>
                  </a>
                  <a class="musica__quitar" href={rutaCancion(idDe(c), c.t ?? 0)} aria-label={`Reproducir «${c.titulo ?? 'canción'}» desde su segundo`}>
                    ▷
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {e.fuente === 'youtube' && e.canciones.length > 0 && (
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
