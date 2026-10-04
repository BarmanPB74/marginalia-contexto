import { useEffect, useState } from 'preact/hooks';
import { PantallaAjustes } from '../features/ajustes/PantallaAjustes';
import { PantallaCalendario } from '../features/calendario/PantallaCalendario';
import { PantallaMusica } from '../features/musica/PantallaMusica';
import { PantallaNotas } from '../features/notas/PantallaNotas';
import { BarraInferior } from '../ui/BarraInferior';
import { Galeria } from './Galeria';
import { rutaActual } from './rutas';

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

export function App() {
  const ruta = useRuta();
  if (ruta === 'galeria') return <Galeria />;
  const Pantalla = PANTALLAS[ruta];
  return (
    <>
      <Pantalla />
      <BarraInferior actual={ruta} />
    </>
  );
}
