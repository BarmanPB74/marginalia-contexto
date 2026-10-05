import { useEffect, useState } from 'preact/hooks';
import { PantallaAjustes } from '../features/ajustes/PantallaAjustes';
import { PantallaCalendario } from '../features/calendario/PantallaCalendario';
import { CANCION_DEMO } from '../features/musica/demo';
import { MiniReproductor } from '../features/musica/MiniReproductor';
import { PantallaMusica } from '../features/musica/PantallaMusica';
import { PantallaNota } from '../features/notas/PantallaNota';
import { PantallaNotas } from '../features/notas/PantallaNotas';
import { BarraInferior } from '../ui/BarraInferior';
import { ProveedorEstado, useEstado } from './estado';
import { Galeria } from './Galeria';
import { idNotaEnRuta, rutaActual, type IdSeccion } from './rutas';

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

function Secciones({ ruta, idNota }: { ruta: IdSeccion; idNota: string | null }) {
  const { flotante, sonando, alternar, miniEscondido, cambiarAjustes } = useEstado();
  const Pantalla = PANTALLAS[ruta];
  // En Música ya está el reproductor grande. F1: siempre hay una canción de muestra; en F4, solo si hay algo cargado.
  const conMini = ruta !== 'musica';
  const anclado = conMini && !flotante && !miniEscondido;
  return (
    <div class={anclado ? 'con-mini-anclado' : undefined}>
      {/* key: al cambiar de nota se desmonta la anterior, que guarda lo pendiente */}
      {idNota ? <PantallaNota key={idNota} id={idNota} /> : <Pantalla />}
      {conMini && (
        <MiniReproductor
          titulo={CANCION_DEMO.titulo}
          artista={CANCION_DEMO.artista}
          sonando={sonando}
          alAlternar={alternar}
          modo={flotante ? 'flotante' : 'anclado'}
          escondido={miniEscondido}
          alEsconder={(lado) => cambiarAjustes({ miniEscondido: lado })}
        />
      )}
      <BarraInferior actual={ruta} />
    </div>
  );
}

export function App() {
  const hash = useHash();
  const ruta = rutaActual(hash);
  return (
    <ProveedorEstado>
      {ruta === 'galeria' ? <Galeria /> : <Secciones ruta={ruta} idNota={idNotaEnRuta(hash)} />}
    </ProveedorEstado>
  );
}
