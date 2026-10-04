import { useEffect, useState } from 'preact/hooks';
import { SpikeReproductor } from '../spike/SpikeReproductor';
import { Galeria } from './Galeria';

/** Ruta actual a partir del hash (#/galeria). El hash funciona igual en la WebView, en preview y en el navegador. */
export function rutaActual(hash: string): 'inicio' | 'galeria' {
  return hash === '#/galeria' ? 'galeria' : 'inicio';
}

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
  if (useRuta() === 'galeria') return <Galeria />;
  return (
    <main class="inicio">
      <h1 class="titulo">Marginalia</h1>
      <p class="subtitulo">cuaderno en construcción</p>
      <SpikeReproductor />
    </main>
  );
}
