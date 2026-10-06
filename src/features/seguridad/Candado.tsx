import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Boton } from '../../ui/Boton';
import { Bloqueo, enTelefono } from './nativo';
import './Candado.css';

/** Tiempo fuera de la app tras el cual se vuelve a pedir huella/PIN. */
export const ESPERA_MS = 60_000;

/**
 * ¿Hay que bloquear al volver? Un minuto de margen: elegir un ZIP, autorizar Spotify o compartir
 * también sacan a la app un momento, y no debe pedirse la huella cada vez.
 */
export function debeBloquear(ocultaDesde: number | null, ahora: number, espera = ESPERA_MS): boolean {
  return ocultaDesde !== null && ahora - ocultaDesde >= espera;
}

/**
 * Con el bloqueo activo (ADR-014), nada de la app se monta hasta desbloquear: las notas ni
 * siquiera están en la página. Solo en el teléfono; en el navegador no hay a quién preguntar.
 */
export function Candado({ activo, children }: { activo: boolean; children: ComponentChildren }) {
  const usar = activo && enTelefono();
  const [bloqueada, setBloqueada] = useState(usar);
  const [error, setError] = useState('');
  const pidiendo = useRef(false);
  const ocultaDesde = useRef<number | null>(null);

  useEffect(() => {
    void Bloqueo.ocultarEnRecientes({ ocultar: usar }).catch(() => undefined);
    if (!usar) {
      setBloqueada(false);
      return;
    }
    const alCambiar = () => {
      if (document.visibilityState === 'hidden') {
        ocultaDesde.current ??= Date.now();
        return;
      }
      if (debeBloquear(ocultaDesde.current, Date.now())) setBloqueada(true);
      ocultaDesde.current = null;
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [usar]);

  async function desbloquear() {
    if (pidiendo.current) return;
    pidiendo.current = true;
    setError('');
    try {
      await Bloqueo.autenticar({ titulo: 'Marginalia', subtitulo: 'Desbloquea tus notas' });
      setBloqueada(false);
    } catch (e) {
      const codigo = (e as { code?: unknown } | null)?.code;
      setError(codigo === 'CANCELADO' ? '' : 'No se pudo comprobar. Prueba otra vez.');
    } finally {
      pidiendo.current = false;
    }
  }

  // Al aparecer el candado, el diálogo se abre solo
  useEffect(() => {
    if (bloqueada) void desbloquear();
  }, [bloqueada]);

  if (!bloqueada) return <>{children}</>;
  return (
    <main class="candado" aria-label="Marginalia bloqueada">
      <p class="candado__titulo">Marginalia está bloqueada</p>
      <p class="candado__pista">Usa tu huella, tu rostro o el PIN del teléfono.</p>
      <Boton alTocar={() => void desbloquear()}>Desbloquear</Boton>
      {error && (
        <p class="candado__error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
