import { useEffect, useState } from 'preact/hooks';
import { PantallaAjustes } from '../features/ajustes/PantallaAjustes';
import { PantallaCalendario } from '../features/calendario/PantallaCalendario';
import { Paleta } from '../features/comandos/Paleta';
import { miniatura } from '../core/musica/canciones';
import { MiniReproductor } from '../features/musica/MiniReproductor';
import { PantallaMusica } from '../features/musica/PantallaMusica';
import { PantallaNota } from '../features/notas/PantallaNota';
import { PantallaNotas } from '../features/notas/PantallaNotas';
import { BarraInferior } from '../ui/BarraInferior';
import { ProveedorEstado, useEstado } from './estado';
import { Galeria } from './Galeria';
import { diaEnRuta, idNotaEnRuta, rutaActual, type IdSeccion } from './rutas';

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

function Secciones({ ruta, idNota, dia }: { ruta: IdSeccion; idNota: string | null; dia: string | null }) {
  const { flotante, sonando, miniEscondido, cambiarAjustes, comandosAbiertos, cancion } = useEstado();
  const Pantalla = PANTALLAS[ruta];
  // En Música ya está el reproductor grande.
  const conMini = ruta !== 'musica';
  const anclado = conMini && !flotante && !miniEscondido;
  return (
    <div class={anclado ? 'con-mini-anclado' : undefined}>
      {/* key: al cambiar de nota se desmonta la anterior, que guarda lo pendiente */}
      {idNota ? (
        <PantallaNota key={idNota} id={idNota} />
      ) : ruta === 'calendario' ? (
        <PantallaCalendario dia={dia} />
      ) : (
        <Pantalla />
      )}
      {conMini && (
        <MiniReproductor
          titulo={cancion?.titulo ?? 'Nada sonando'}
          artista={cancion ? cancion.artista : 'Toca para elegir música'}
          portada={cancion ? miniatura(cancion.enlace) : null}
          sonando={sonando}
          // El reproductor oficial vive en Música (visible, LEGAL §1): reproducir lleva allí.
          alAlternar={() => (location.hash = '#/musica')}
          modo={flotante ? 'flotante' : 'anclado'}
          escondido={miniEscondido}
          alEsconder={(lado) => cambiarAjustes({ miniEscondido: lado })}
        />
      )}
      <BarraInferior actual={ruta} />
      {comandosAbiertos && <Paleta />}
    </div>
  );
}

export function App() {
  const hash = useHash();
  const ruta = rutaActual(hash);
  return (
    <ProveedorEstado>
      {ruta === 'galeria' ? <Galeria /> : <Secciones ruta={ruta} idNota={idNotaEnRuta(hash)} dia={diaEnRuta(hash)} />}
    </ProveedorEstado>
  );
}
