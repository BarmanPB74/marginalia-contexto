import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { aplicarTema, guardarAjustes, leerAjustes, type Ajustes } from './ajustes';

interface EstadoApp extends Ajustes {
  /** Cambia una o varias preferencias y las guarda en el teléfono. */
  cambiarAjustes: (parcial: Partial<Ajustes>) => void;
  setFlotante: (valor: boolean) => void;
  /** Compartido por el reproductor grande y el pequeño. */
  sonando: boolean;
  alternar: () => void;
  /** Paleta de comandos abierta. */
  comandosAbiertos: boolean;
  abrirComandos: (abierta: boolean) => void;
}

const Contexto = createContext<EstadoApp | null>(null);

export function ProveedorEstado({ children }: { children: ComponentChildren }) {
  const [ajustes, setAjustes] = useState<Ajustes>(leerAjustes);
  const [sonando, setSonando] = useState(false);
  const [comandosAbiertos, abrirComandos] = useState(false);

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
        sonando,
        alternar: () => setSonando((s) => !s),
        comandosAbiertos,
        abrirComandos,
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
