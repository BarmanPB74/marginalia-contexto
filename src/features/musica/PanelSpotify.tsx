import { useEffect, useState } from 'preact/hooks';
import { useEstado } from '../../app/estado';
import { URI_SPOTIFY } from '../../core/musica/etiqueta';
import { leerEnlaceSpotify, urlSpotify } from '../../core/musica/spotify';
import { Boton } from '../../ui/Boton';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Reproductor } from './Reproductor';

/**
 * Música desde Spotify (ADR-013). No hay video ni audio aquí: Spotify suena en su propia app,
 * también en segundo plano. Este panel conecta, pega enlaces, muestra qué suena y guarda el
 * segundo exacto en una nota (♪).
 */
export function PanelSpotify({ alNotaConCancion }: { alNotaConCancion: (uri: string, segundo: number) => void }) {
  const e = useEstado();
  const s = e.spotify;
  const [texto, setTexto] = useState('');
  const [errorEnlace, setErrorEnlace] = useState('');
  // Mientras suena, el progreso avanza solo (Spotify solo avisa al cambiar algo)
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!s.sonando) return;
    const reloj = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(reloj);
  }, [s.sonando]);

  function pegar(ev?: Event) {
    ev?.preventDefault();
    const enlace = leerEnlaceSpotify(texto);
    if (!enlace) {
      setErrorEnlace('Ese no parece un enlace de Spotify. Usa «Compartir → Copiar enlace» en la app de Spotify.');
      return;
    }
    setErrorEnlace('');
    setTexto('');
    e.ponerSpotify(enlace.uri);
  }

  if (!s.disponible) {
    return (
      <EstadoVacio
        mensaje="Spotify suena en su propia app."
        pista="Funciona en la app de Android con Spotify instalado. En el navegador usa YouTube Music."
      />
    );
  }

  const estado = s.estado;
  const segundo = s.segundo();
  const marcable = !!estado?.uri && URI_SPOTIFY.test(estado.uri);
  return (
    <>
      <form class="musica__pegar" onSubmit={pegar}>
        <input
          class="musica__entrada"
          type="url"
          inputMode="url"
          enterKeyHint="go"
          aria-label="Enlace de Spotify"
          placeholder="Pega un enlace de Spotify"
          value={texto}
          onInput={(ev) => setTexto(ev.currentTarget.value)}
        />
        <Boton alTocar={() => pegar()} desactivado={!texto.trim() || s.conectando}>
          Poner
        </Boton>
      </form>
      {(errorEnlace || s.error) && (
        <p class="musica__error" role="alert">
          {errorEnlace || s.error}
        </p>
      )}

      {s.conectado && estado ? (
        <Reproductor
          titulo={estado.titulo ?? 'Spotify'}
          artista={estado.artista ?? ''}
          posicion={segundo}
          duracion={Math.floor((estado.duracionMs ?? 0) / 1000)}
          sonando={s.sonando}
          alAlternar={s.alternar}
          alAnterior={s.anterior}
          alSiguiente={s.siguiente}
        />
      ) : (
        <div class="musica__acciones">
          <Boton desactivado={s.conectando} alTocar={() => void s.conectar(e.spotifyClientId)}>
            {s.conectando ? 'Conectando…' : 'Conectar con Spotify'}
          </Boton>
          {!e.spotifyClientId && (
            <p class="musica__abrir">
              Primero escribe el Client ID de tu app de Spotify en <a href="#/ajustes">Ajustes</a>.
            </p>
          )}
        </div>
      )}

      {s.conectado && marcable && estado?.uri && (
        <div class="musica__acciones">
          <Boton alTocar={() => alNotaConCancion(estado.uri as string, s.segundo())}>♪ Nueva nota con esta canción</Boton>
        </div>
      )}
      {estado?.uri && (
        <p class="musica__abrir">
          <a href={urlSpotify(estado.uri)} target="_blank" rel="noopener noreferrer">
            Abrir en Spotify
          </a>
        </p>
      )}
      <p class="musica__abrir">Suena en la app de Spotify: puedes salir de Marginalia o apagar la pantalla.</p>
    </>
  );
}
