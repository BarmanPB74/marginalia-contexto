import { createContext, type ComponentChildren } from 'preact';
import { useContext, useState } from 'preact/hooks';

interface EstadoApp {
  /** Ajustes → "Reproductor flotante". F1: solo en memoria (guardar datos llega en F2). */
  flotante: boolean;
  setFlotante: (valor: boolean) => void;
  /** Compartido por el reproductor grande y el pequeño. F1: solo cambia el dibujo, no hay sonido. */
  sonando: boolean;
  alternar: () => void;
}

const Contexto = createContext<EstadoApp | null>(null);

export function ProveedorEstado({ children }: { children: ComponentChildren }) {
  const [flotante, setFlotante] = useState(false);
  const [sonando, setSonando] = useState(false);
  return (
    <Contexto.Provider value={{ flotante, setFlotante, sonando, alternar: () => setSonando((s) => !s) }}>
      {children}
    </Contexto.Provider>
  );
}

export function useEstado(): EstadoApp {
  const estado = useContext(Contexto);
  if (!estado) throw new Error('useEstado necesita <ProveedorEstado>');
  return estado;
}
