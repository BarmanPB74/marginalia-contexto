import { useEffect, useRef, useState } from 'preact/hooks';
import { CLIENT_ID, Spotify, estadoSeguro, mensajeSpotify, segundoAhora, spotifyDisponible, type EstadoSpotify } from './spotifyRemoto';

export interface ControlSpotify {
  disponible: boolean;
  conectado: boolean;
  conectando: boolean;
  estado: EstadoSpotify | null;
  /** Último error, ya en palabras; vacío si no hay */
  error: string;
  sonando: boolean;
  /** Segundo actual, interpolado entre avisos */
  segundo: () => number;
  conectar: (clientId: string) => Promise<boolean>;
  reproducir: (clientId: string, uri: string, t?: number) => Promise<boolean>;
  alternar: () => void;
  pausar: () => void;
  anterior: () => void;
  siguiente: () => void;
  saltar: (segundo: number) => void;
}

/** Estado de Spotify App Remote (ADR-013) para toda la app. Vive en ProveedorEstado. */
export function useSpotify(): ControlSpotify {
  const disponible = spotifyDisponible();
  const [conectado, setConectadoEstado] = useState(false);
  // También en un ref: lo leen funciones guardadas por efectos montados una sola vez
  const conectadoRef = useRef(false);
  const setConectado = (v: boolean) => {
    conectadoRef.current = v;
    setConectadoEstado(v);
  };
  const [conectando, setConectando] = useState(false);
  const [estado, setEstado] = useState<EstadoSpotify | null>(null);
  const [error, setError] = useState('');
  const recibido = useRef(0);

  function recibir(datos: unknown) {
    const limpio = estadoSeguro(datos);
    if (!limpio) return;
    recibido.current = Date.now();
    setEstado(limpio);
  }

  function fallo(e: unknown) {
    if ((e as { code?: unknown } | null)?.code === 'DESCONECTADO') setConectado(false);
    setError(mensajeSpotify(e));
  }

  useEffect(() => {
    if (!disponible) return;
    const asa = Spotify.addListener('estado', recibir);
    // Al volver a la app, el estado puede haber cambiado (o Spotify se cerró)
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      Spotify.estado().then(recibir, () => setConectado(false));
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      void asa.then((a) => a.remove());
    };
  }, [disponible]);

  async function conectar(clientId: string): Promise<boolean> {
    if (!disponible) {
      setError('Spotify solo funciona en la app de Android, con la app de Spotify instalada.');
      return false;
    }
    if (!CLIENT_ID.test(clientId)) {
      setError('Escribe el Client ID de tu app de Spotify en Ajustes → Spotify.');
      return false;
    }
    setConectando(true);
    setError('');
    try {
      await Spotify.conectar({ clientId });
      setConectado(true);
      Spotify.estado().then(recibir, () => undefined);
      return true;
    } catch (e) {
      setConectado(false);
      fallo(e);
      return false;
    } finally {
      setConectando(false);
    }
  }

  const orden = (accion: () => Promise<void>) => {
    if (!conectadoRef.current) return;
    accion().catch(fallo);
  };

  return {
    disponible,
    conectado,
    conectando,
    estado,
    error,
    sonando: conectado && !!estado && !estado.pausado,
    segundo: () => segundoAhora(estado, recibido.current, Date.now()),
    conectar,
    reproducir: async (clientId, uri, t = 0) => {
      if (!conectadoRef.current && !(await conectar(clientId))) return false;
      try {
        await Spotify.reproducir({ uri, posicionMs: Math.max(0, Math.floor(t)) * 1000 });
        setError('');
        return true;
      } catch (e) {
        fallo(e);
        return false;
      }
    },
    alternar: () => orden(() => (estado && !estado.pausado ? Spotify.pausar() : Spotify.reanudar())),
    pausar: () => orden(() => Spotify.pausar()),
    anterior: () => orden(() => Spotify.anterior()),
    siguiente: () => orden(() => Spotify.siguiente()),
    saltar: (segundo) => orden(() => Spotify.saltar({ posicionMs: Math.max(0, Math.floor(segundo)) * 1000 })),
  };
}
