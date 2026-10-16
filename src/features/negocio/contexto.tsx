import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { Negocio, type EstadoNegocio, type UsuarioPublico } from '../../core/negocio';
import { almacenDeLaApp } from '../notas/contexto';

/**
 * El negocio abierto (ADR-015): diario de eventos cifrado en la carpeta privada de la app.
 * Las pantallas leen `estado` (se vuelve a pintar con cada evento) y llaman a `negocio.*`.
 */
export interface NegocioApp {
  negocio: Negocio;
  estado: EstadoNegocio;
  sesion: UsuarioPublico | null;
}

type Carga = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; app: NegocioApp };

const Contexto = createContext<NegocioApp | null>(null);

/** Las pruebas inyectan aquí un negocio en memoria (con sesión ya abierta) para toda la App. */
export const NegocioDePrueba = createContext<Negocio | null>(null);

/** Minutos fuera de la app tras los que se cierra la sesión (hay que volver a poner el PIN). */
export const SESION_MINUTOS = 10;

let abierto: Promise<Negocio> | undefined;
const abrir = () => (abierto ??= Negocio.crear(almacenDeLaApp()).catch((e: unknown) => {
  abierto = undefined;
  throw e;
}));

/** `negocio` permite a las pruebas pasar uno en memoria. */
export function ProveedorNegocio({ children, negocio: propio }: { children: ComponentChildren; negocio?: Negocio }) {
  const inyectado = useContext(NegocioDePrueba);
  const negocio = propio ?? inyectado ?? undefined;
  const [carga, setCarga] = useState<Carga>(() =>
    negocio ? { tipo: 'listo', app: foto(negocio) } : { tipo: 'cargando' },
  );

  useEffect(() => {
    let vigente = true;
    let soltar: () => void = () => undefined;
    (negocio ? Promise.resolve(negocio) : abrir()).then(
      (n) => {
        if (!vigente) return;
        setCarga({ tipo: 'listo', app: foto(n) });
        soltar = n.suscribir(() => vigente && setCarga({ tipo: 'listo', app: foto(n) }));
      },
      (e: unknown) =>
        vigente &&
        setCarga({
          tipo: 'error',
          mensaje: e instanceof Error ? e.message : 'No se pudo abrir el registro del negocio.',
        }),
    );
    return () => {
      vigente = false;
      soltar();
    };
  }, [negocio]);

  // Fuera de la app más de SESION_MINUTOS → se cierra la sesión (el teléfono puede quedar en otra mano)
  useEffect(() => {
    if (carga.tipo !== 'listo') return;
    let oculta: number | null = null;
    const alCambiar = () => {
      if (document.visibilityState === 'hidden') {
        oculta ??= Date.now();
        return;
      }
      if (oculta !== null && Date.now() - oculta >= SESION_MINUTOS * 60_000) {
        carga.app.negocio.cerrarSesion();
        setCarga({ tipo: 'listo', app: foto(carga.app.negocio) });
      }
      oculta = null;
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [carga.tipo === 'listo' ? carga.app.negocio : null]);

  if (carga.tipo === 'cargando') {
    return (
      <main class="pagina pagina--lectura" aria-busy="true">
        <p>Abriendo el negocio…</p>
      </main>
    );
  }
  if (carga.tipo === 'error') {
    return (
      <main class="pagina pagina--lectura">
        <h1>No se pudo abrir el registro</h1>
        <p role="alert">{carga.mensaje}</p>
        <p>
          Por seguridad la app no escribe sobre un registro que no cuadra. No borres datos: haz una copia
          (Ajustes del teléfono no la borran) y revisa con el dueño.
        </p>
      </main>
    );
  }
  return <Contexto.Provider value={carga.app}>{children}</Contexto.Provider>;
}

function foto(n: Negocio): NegocioApp {
  return { negocio: n, estado: n.estado, sesion: n.sesion };
}

export function useNegocio(): NegocioApp {
  const app = useContext(Contexto);
  if (!app) throw new Error('useNegocio necesita <ProveedorNegocio>');
  return app;
}

export function useNegocioOpcional(): NegocioApp | null {
  return useContext(Contexto);
}
