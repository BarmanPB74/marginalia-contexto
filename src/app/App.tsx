import { useEffect, useState } from 'preact/hooks';
import { PantallaAjustes } from '../features/ajustes/PantallaAjustes';
import { PantallaCalendario } from '../features/calendario/PantallaCalendario';
import { CANCION_DEMO } from '../features/musica/demo';
import { MiniReproductor } from '../features/musica/MiniReproductor';
import { PantallaMusica } from '../features/musica/PantallaMusica';
import { PantallaNotas } from '../features/notas/PantallaNotas';
import { BarraInferior } from '../ui/BarraInferior';
import { ProveedorEstado, useEstado } from './estado';
import { Galeria } from './Galeria';
import { rutaActual, type IdSeccion } from './rutas';

const PANTALLAS = {
  notas: PantallaNotas,
  calendario: PantallaCalendario,
  musica: PantallaMusica,
  ajustes: PantallaAjustes,
};

function useRuta() {
  const [ruta, setRuta] = useState(() => rutaActual(location.hash));
  useEffect(() => {
    const alCambiar = () => setRuta(rutaActual(location.hash));
    addEventListener('hashchange', alCambiar);
    return () => removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}

function Secciones({ ruta }: { ruta: IdSeccion }) {
  const { flotante, sonando, alternar } = useEstado();
  const Pantalla = PANTALLAS[ruta];
  // En Música ya está el reproductor grande. F1: siempre hay una canción de muestra; en F4, solo si hay algo cargado.
  const conMini = ruta !== 'musica';
  const anclado = conMini && !flotante;
  return (
    <div class={anclado ? 'con-mini-anclado' : undefined}>
      <Pantalla />
      {conMini && (
        <MiniReproductor
          titulo={CANCION_DEMO.titulo}
          artista={CANCION_DEMO.artista}
          sonando={sonando}
          alAlternar={alternar}
          modo={flotante ? 'flotante' : 'anclado'}
        />
      )}
      <BarraInferior actual={ruta} />
    </div>
  );
}

export function App() {
  const ruta = useRuta();
  return (
    <ProveedorEstado>{ruta === 'galeria' ? <Galeria /> : <Secciones ruta={ruta} />}</ProveedorEstado>
  );
}
