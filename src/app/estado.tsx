import { createContext, type ComponentChildren, type RefObject } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { conCancion, guardarCanciones, leerCanciones, type Cancion } from '../core/musica/canciones';
import type { Comando } from '../features/comandos/comandos';
import type { ControlVideo, InfoVideo } from '../features/musica/VideoOficial';
import { aplicarTema, guardarAjustes, leerAjustes, type Ajustes } from './ajustes';

interface EstadoApp extends Ajustes {
  /** Cambia una o varias preferencias y las guarda en el teléfono. */
  cambiarAjustes: (parcial: Partial<Ajustes>) => void;
  setFlotante: (valor: boolean) => void;
  /** Compartido por el reproductor grande y el pequeño. */
  sonando: boolean;
  alternar: () => void;
  /** Canción elegida (la primera de las guardadas) y lo que informa el reproductor oficial. */
  cancion: Cancion | null;
  canciones: Cancion[];
  /** Pone una canción (la sube al principio de las guardadas) desde `inicio` segundos. */
  elegirCancion: (c: Cancion, inicio?: number) => void;
  /** Cada elección cuenta: el reproductor se vuelve a cargar en el segundo pedido */
  eleccion: { vez: number; inicio: number };
  quitarCancion: (clave: string) => void;
  /** Cambia título/artista de una guardada sin volver a cargar el reproductor */
  datosCancion: (clave: string, datos: { titulo: string; artista: string }) => void;
  info: InfoVideo;
  alCambiarVideo: (info: Partial<InfoVideo>) => void;
  control: RefObject<ControlVideo | null>;
  /** Paleta de comandos abierta. */
  comandosAbiertos: boolean;
  abrirComandos: (abierta: boolean) => void;
  /** Aviso corto que aparece abajo unos segundos (resultado de exportar, importar…) */
  aviso: string;
  avisar: (mensaje: string) => void;
  /** Comandos de la pantalla actual (p. ej. los de la nota abierta), además de los globales. */
  comandosLocales: Comando[];
  setComandosLocales: (comandos: Comando[]) => void;
}

const Contexto = createContext<EstadoApp | null>(null);

export function ProveedorEstado({ children }: { children: ComponentChildren }) {
  const [ajustes, setAjustes] = useState<Ajustes>(leerAjustes);
  const [canciones, setCanciones] = useState<Cancion[]>(leerCanciones);
  const [info, setInfo] = useState<InfoVideo>({ sonando: false, posicion: 0, duracion: 0 });
  const control = useRef<ControlVideo | null>(null);
  const [eleccion, setEleccion] = useState({ vez: 0, inicio: 0 });
  const [comandosAbiertos, abrirComandos] = useState(false);
  const [comandosLocales, setComandosLocales] = useState<Comando[]>([]);
  const [aviso, avisar] = useState('');

  useEffect(() => {
    if (!aviso) return;
    const reloj = setTimeout(() => avisar(''), 7000);
    return () => clearTimeout(reloj);
  }, [aviso]);

  // Ctrl+K (o ⌘K) abre la paleta desde cualquier pantalla con teclado físico.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrirComandos(true);
      }
    };
    addEventListener('keydown', alTeclear);
    return () => removeEventListener('keydown', alTeclear);
  }, []);

  useEffect(() => {
    aplicarTema(ajustes.tema);
    if (ajustes.tema !== 'sistema') return;
    // Siguiendo al teléfono: al cambiar su apariencia, la barra de estado también cambia.
    const consulta = matchMedia?.('(prefers-color-scheme: dark)');
    const alCambiar = () => aplicarTema('sistema');
    consulta?.addEventListener?.('change', alCambiar);
    return () => consulta?.removeEventListener?.('change', alCambiar);
  }, [ajustes.tema]);

  function cambiarAjustes(parcial: Partial<Ajustes>) {
    setAjustes((actuales) => {
      const nuevos = { ...actuales, ...parcial };
      guardarAjustes(nuevos);
      return nuevos;
    });
  }

  return (
    <Contexto.Provider
      value={{
        ...ajustes,
        cambiarAjustes,
        setFlotante: (flotante) => cambiarAjustes({ flotante }),
        sonando: info.sonando,
        alternar: () => {
          // Con el reproductor oficial en pantalla, se le ordena; si no, al menos cambia el dibujo.
          if (control.current) {
            if (info.sonando) control.current.pausar();
            else control.current.reproducir();
          }
          setInfo((i) => ({ ...i, sonando: !i.sonando }));
        },
        cancion: canciones[0] ?? null,
        canciones,
        elegirCancion: (c, inicio = c.enlace.inicio ?? 0) => {
          // En la lista guardada no se queda el segundo: eso es de cada etiqueta ♪
          const enlace = { ...c.enlace };
          delete enlace.inicio;
          const lista = conCancion(canciones, { ...c, enlace });
          setCanciones(lista);
          guardarCanciones(lista);
          // Canción nueva: sin el error de la anterior
          setInfo({ sonando: true, posicion: inicio, duracion: 0 });
          setEleccion((e) => ({ vez: e.vez + 1, inicio }));
        },
        eleccion,
        datosCancion: (clave, datos) => {
          setCanciones((actuales) => {
            const lista = actuales.map((c) => (c.clave === clave ? { ...c, ...datos } : c));
            guardarCanciones(lista);
            return lista;
          });
        },
        quitarCancion: (clave) => {
          const lista = canciones.filter((c) => c.clave !== clave);
          setCanciones(lista);
          guardarCanciones(lista);
        },
        info,
        alCambiarVideo: (parcial) => setInfo((i) => ({ ...i, ...parcial })),
        control,
        comandosAbiertos,
        abrirComandos,
        comandosLocales,
        setComandosLocales,
        aviso,
        avisar,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

/** Para pantallas que también se prueban sueltas, sin <ProveedorEstado>. */
export function useEstadoOpcional(): EstadoApp | null {
  return useContext(Contexto);
}

export function useEstado(): EstadoApp {
  const estado = useContext(Contexto);
  if (!estado) throw new Error('useEstado necesita <ProveedorEstado>');
  return estado;
}
