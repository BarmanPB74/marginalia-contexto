import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { Comando } from '../features/comandos/comandos';
import { aplicarTema, guardarAjustes, leerAjustes, type Ajustes } from './ajustes';

interface EstadoApp extends Ajustes {
  /** Cambia una o varias preferencias y las guarda en el teléfono. */
  cambiarAjustes: (parcial: Partial<Ajustes>) => void;
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
