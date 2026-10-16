import { useEffect, useState } from 'preact/hooks';
import { PantallaAjustes } from '../features/ajustes/PantallaAjustes';
import { PantallaCalendario } from '../features/calendario/PantallaCalendario';
import { Paleta } from '../features/comandos/Paleta';
import { PantallaNota } from '../features/notas/PantallaNota';
import { PantallaNotas } from '../features/notas/PantallaNotas';
import { ProveedorNegocio } from '../features/negocio/contexto';
import { PANTALLAS_GESTION } from '../features/registro/gestion';
import { PANTALLAS_INVENTARIO } from '../features/registro/inventario';
import { PANTALLAS_VENTAS } from '../features/registro/ventas';
import { Candado } from '../features/seguridad/Candado';
import { Sesion } from '../features/sesion/Sesion';
import { BarraInferior } from '../ui/BarraInferior';
import { ProveedorEstado, useEstado } from './estado';
import { Galeria } from './Galeria';
import { diaEnRuta, etiquetaEnRuta, idNotaEnRuta, rutaActual, type IdSeccion } from './rutas';

import type { FunctionComponent } from 'preact';

/** Pantalla de cada sección. Las de negocio se registran al integrarse (ADR-015). */
const PANTALLAS: Partial<Record<IdSeccion, FunctionComponent>> = {
  ...PANTALLAS_VENTAS,
  ...PANTALLAS_INVENTARIO,
  ...PANTALLAS_GESTION,
  ajustes: PantallaAjustes,
};

function EnConstruccion() {
  return <main class="pagina">Pronto.</main>;
}

function useHash() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const alCambiar = () => setHash(location.hash);
    const ventana = window;
    ventana.addEventListener('hashchange', alCambiar);
    return () => ventana.removeEventListener('hashchange', alCambiar);
  }, []);
  return hash;
}

interface PropsSecciones {
  ruta: IdSeccion;
  idNota: string | null;
  dia: string | null;
  etiqueta: string | null;
}

function Secciones({ ruta, idNota, dia, etiqueta }: PropsSecciones) {
  const { comandosAbiertos, aviso, avisar } = useEstado();
  const Pantalla = PANTALLAS[ruta] ?? EnConstruccion;
  return (
    <div>
      {/* key: al cambiar de nota se desmonta la anterior, que guarda lo pendiente */}
      {idNota ? (
        <PantallaNota key={idNota} id={idNota} />
      ) : ruta === 'calendario' ? (
        <PantallaCalendario dia={dia} />
      ) : ruta === 'notas' ? (
        <PantallaNotas etiqueta={etiqueta} />
      ) : (
        <Pantalla />
      )}
      <BarraInferior actual={ruta} />
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

function ConCandado({ hash }: { hash: string }) {
  const { bloqueo } = useEstado();
  const ruta = rutaActual(hash);
  return (
    <Candado activo={bloqueo}>
      {ruta === 'galeria' ? (
        <Galeria />
      ) : (
        // Huella del teléfono (Candado) → negocio abierto → persona con su PIN (Sesion) → la app
        <ProveedorNegocio>
          <Sesion>
            <Secciones ruta={ruta} idNota={idNotaEnRuta(hash)} dia={diaEnRuta(hash)} etiqueta={etiquetaEnRuta(hash)} />
          </Sesion>
        </ProveedorNegocio>
      )}
    </Candado>
  );
}

export function App() {
  const hash = useHash();
  return (
    <ProveedorEstado>
      <ConCandado hash={hash} />
    </ProveedorEstado>
  );
}
