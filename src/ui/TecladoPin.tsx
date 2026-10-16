import { useEffect, useRef } from 'preact/hooks';
import { Icono, type NombreIcono } from './Icono';
import './TecladoPin.css';

interface Props {
  /** Dígitos escritos hasta ahora (nunca se muestran: solo puntos) */
  valor: string;
  alCambiar: (valor: string) => void;
  /** Se llama una vez al completar `longitud` dígitos */
  alCompletar: (pin: string) => void;
  longitud?: number | undefined;
  /** Instrucción visible ("Escribe tu PIN") */
  etiqueta?: string | undefined;
  /** Error de la última prueba ("PIN incorrecto"): se anuncia y los puntos tiemblan */
  error?: string | undefined;
  /** Acción de la esquina inferior izquierda ("Cambiar usuario") */
  accion?: ({ etiqueta: string; icono: NombreIcono; alTocar: () => void }) | undefined;
  desactivado?: boolean | undefined;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Teclado de PIN: rejilla 3×4 grande, puntos de progreso y sin mostrar nunca los dígitos.
 * También acepta el teclado físico (tabletas con teclado) mientras está montado.
 */
export function TecladoPin({
  valor,
  alCambiar,
  alCompletar,
  longitud = 4,
  etiqueta = 'Escribe tu PIN',
  error,
  accion,
  desactivado = false,
}: Props) {
  // Último estado para el oyente de teclado físico, sin volver a registrarlo
  const estado = useRef({ valor, alCambiar, alCompletar, longitud, desactivado });
  estado.current = { valor, alCambiar, alCompletar, longitud, desactivado };

  const pulsar = (d: string) => {
    const s = estado.current;
    if (s.desactivado || s.valor.length >= s.longitud) return;
    const nuevo = s.valor + d;
    s.alCambiar(nuevo);
    if (nuevo.length === s.longitud) s.alCompletar(nuevo);
  };
  const borrar = () => {
    const s = estado.current;
    if (!s.desactivado) s.alCambiar(s.valor.slice(0, -1));
  };

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      if (destino?.closest('input, textarea, [contenteditable="true"]')) return;
      if (/^[0-9]$/.test(e.key)) pulsar(e.key);
      else if (e.key === 'Backspace') borrar();
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', alTeclear);
    return () => removeEventListener('keydown', alTeclear);
  }, []);

  return (
    <div class="teclado-pin" role="group" aria-label={etiqueta}>
      <p class="teclado-pin__etiqueta">{etiqueta}</p>
      <div
        key={error}
        class={`teclado-pin__puntos${error ? ' teclado-pin__puntos--error' : ''}`}
        role="img"
        aria-label={`${valor.length} de ${longitud} dígitos`}
      >
        {Array.from({ length: longitud }, (_, i) => (
          <span key={i} class={`teclado-pin__punto${i < valor.length ? ' teclado-pin__punto--lleno' : ''}`} />
        ))}
      </div>
      <p class="teclado-pin__error" role="alert">
        {error ?? ''}
      </p>
      <div class="teclado-pin__rejilla">
        {TECLAS.map((d) => (
          <button key={d} type="button" class="teclado-pin__tecla cifras" disabled={desactivado} onClick={() => pulsar(d)}>
            {d}
          </button>
        ))}
        {accion ? (
          <button type="button" class="teclado-pin__tecla teclado-pin__tecla--accion" aria-label={accion.etiqueta} onClick={accion.alTocar}>
            <Icono nombre={accion.icono} tamano={26} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <button type="button" class="teclado-pin__tecla cifras" disabled={desactivado} onClick={() => pulsar('0')}>
          0
        </button>
        <button
          type="button"
          class="teclado-pin__tecla teclado-pin__tecla--accion"
          aria-label="Borrar"
          disabled={desactivado || valor === ''}
          onClick={borrar}
        >
          <Icono nombre="retroceso" tamano={28} />
        </button>
      </div>
    </div>
  );
}
