import { useEffect, useRef, useState } from 'preact/hooks';
import { PantallaAjustes } from '../features/ajustes/PantallaAjustes';
import { PantallaCalendario } from '../features/calendario/PantallaCalendario';
import { Paleta } from '../features/comandos/Paleta';
import { miniatura } from '../core/musica/canciones';
import { CapaVideo, type ModoCapa } from '../features/musica/CapaVideo';
import { MiniReproductor } from '../features/musica/MiniReproductor';
import { PantallaMusica } from '../features/musica/PantallaMusica';
import { PantallaNota } from '../features/notas/PantallaNota';
import { PantallaNotas } from '../features/notas/PantallaNotas';
import { BarraInferior } from '../ui/BarraInferior';
import { ProveedorEstado, useEstado } from './estado';
import { Galeria } from './Galeria';
import { cancionEnRuta, diaEnRuta, etiquetaEnRuta, idNotaEnRuta, rutaActual, type IdSeccion } from './rutas';

const PANTALLAS = {
  notas: PantallaNotas,
  calendario: PantallaCalendario,
  musica: PantallaMusica,
  ajustes: PantallaAjustes,
};

function useHash() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const alCambiar = () => setHash(location.hash);
    addEventListener('hashchange', alCambiar);
    return () => removeEventListener('hashchange', alCambiar);
  }, []);
  return hash;
}

interface PropsSecciones {
  ruta: IdSeccion;
  idNota: string | null;
  dia: string | null;
  etiqueta: string | null;
  cancion: { yt: string; t: number } | null;
}

function Secciones({ ruta, idNota, dia, etiqueta, cancion: pedida }: PropsSecciones) {
  const { flotante, sonando, miniEscondido, cambiarAjustes, comandosAbiertos, cancion, aviso, avisar, flotando, setFlotando } =
    useEstado();
  const Pantalla = PANTALLAS[ruta];
  const enMusica = ruta === 'musica' && !idNota;

  // Al salir de Música con la canción sonando, el reproductor sigue como ventana flotante (opción B).
  const antes = useRef(enMusica);
  useEffect(() => {
    if (antes.current && !enMusica) setFlotando(sonando);
    if (enMusica) setFlotando(false);
    antes.current = enMusica;
  }, [enMusica]);

  // `antes.current` aún es la ruta anterior en este render: así el reproductor pasa a flotar en el
  // mismo cuadro, sin desmontarse ni un instante (desmontar el iframe cortaría la canción).
  const saliendoSonando = antes.current && !enMusica && sonando;
  const modoCapa: ModoCapa | null = !cancion ? null : enMusica ? 'musica' : flotando || saliendoSonando ? 'flotante' : null;
  // En Música ya está el reproductor grande; fuera, si flota el video, el globo dibujado sobra.
  const conMini = !enMusica && modoCapa !== 'flotante';
  const anclado = conMini && !flotante && !miniEscondido;
  return (
    <div class={anclado ? 'con-mini-anclado' : undefined}>
      {/* key: al cambiar de nota se desmonta la anterior, que guarda lo pendiente */}
      {idNota ? (
        <PantallaNota key={idNota} id={idNota} />
      ) : ruta === 'calendario' ? (
        <PantallaCalendario dia={dia} />
      ) : ruta === 'notas' ? (
        <PantallaNotas etiqueta={etiqueta} />
      ) : ruta === 'musica' ? (
        <PantallaMusica pedida={pedida} />
      ) : (
        <Pantalla />
      )}
      {conMini && (
        <MiniReproductor
          titulo={cancion?.titulo ?? 'Nada sonando'}
          artista={cancion ? cancion.artista : 'Toca para elegir música'}
          portada={cancion ? miniatura(cancion.enlace) : null}
          sonando={sonando}
          // Sin ventana flotante, el reproductor oficial está en Música: reproducir lleva allí.
          alAlternar={() => (location.hash = '#/musica')}
          modo={flotante ? 'flotante' : 'anclado'}
          escondido={miniEscondido}
          alEsconder={(lado) => cambiarAjustes({ miniEscondido: lado })}
        />
      )}
      <BarraInferior actual={ruta} />
      {/* Siempre en el mismo sitio del árbol: cambiar de modo no recarga el iframe */}
      {modoCapa && <CapaVideo modo={modoCapa} />}
      {comandosAbiertos && <Paleta />}
      <div class="aviso-global" aria-live="polite">
        {aviso && (
          <button type="button" class="aviso-global__texto" onClick={() => avisar('')}>
            {aviso}
          </button>
        )}
      </div>
    </div>
  );
}

export function App() {
  const hash = useHash();
  const ruta = rutaActual(hash);
  return (
    <ProveedorEstado>
      {ruta === 'galeria' ? <Galeria /> : <Secciones ruta={ruta} idNota={idNotaEnRuta(hash)} dia={diaEnRuta(hash)} etiqueta={etiquetaEnRuta(hash)} cancion={cancionEnRuta(hash)} />}
    </ProveedorEstado>
  );
}
