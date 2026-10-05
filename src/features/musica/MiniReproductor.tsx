import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icono } from '../../ui/Icono';
import { limitarPosicion } from './tiempo';
import './MiniReproductor.css';

export type ModoMini = 'anclado' | 'flotante' | 'en-linea';

interface Props {
  titulo: string;
  artista: string;
  sonando: boolean;
  alAlternar: () => void;
  /** anclado: sobre la barra inferior · flotante: arrastrable · en-linea: dentro del flujo (galería) */
  modo: ModoMini;
}

const PASO_TECLADO = 16;
const FLECHAS: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Lo que el flotante no debe tapar abajo: la barra inferior (incluye la zona de gestos de Android). */
function reservaInferior(): number {
  return document.querySelector('.barra-inferior')?.getBoundingClientRect().height ?? 0;
}

/** Alto de la barra de estado (lo inyecta Capacitor; en el navegador es 0). */
function reservaSuperior(): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0;
}

function limitar(punto: { x: number; y: number }, caja: HTMLElement) {
  const { width, height } = caja.getBoundingClientRect();
  return limitarPosicion(
    punto,
    { ancho: width, alto: height },
    { ancho: innerWidth, alto: innerHeight, reservaInferior: reservaInferior(), reservaSuperior: reservaSuperior() },
  );
}

/** Reproductor pequeño. Flota solo dentro de la app (sin permiso de superposición de Android). */
export function MiniReproductor({ titulo, artista, sonando, alAlternar, modo }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<{ x: number; y: number } | null>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  const flotante = modo === 'flotante';

  // Posición inicial del flotante: abajo a la derecha, justo encima de la barra
  useLayoutEffect(() => {
    if (!flotante || !caja.current) return;
    setPosicion(limitar({ x: Infinity, y: Infinity }, caja.current));
  }, [flotante]);

  // Si la pantalla gira o cambia de tamaño, se vuelve a meter dentro
  useEffect(() => {
    if (!flotante) return;
    const alRedimensionar = () => setPosicion((p) => (p && caja.current ? limitar(p, caja.current) : p));
    addEventListener('resize', alRedimensionar);
    return () => removeEventListener('resize', alRedimensionar);
  }, [flotante]);

  function mover(x: number, y: number) {
    if (caja.current) setPosicion(limitar({ x, y }, caja.current));
  }

  function alPresionar(e: PointerEvent) {
    if (!posicion) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrastre.current = { dx: e.clientX - posicion.x, dy: e.clientY - posicion.y };
  }

  function alArrastrar(e: PointerEvent) {
    if (arrastre.current) mover(e.clientX - arrastre.current.dx, e.clientY - arrastre.current.dy);
  }

  function alSoltar() {
    arrastre.current = null;
  }

  function alTeclear(e: KeyboardEvent) {
    if (!posicion) return;
    const delta = FLECHAS[e.key];
    if (!delta) return;
    e.preventDefault();
    const [dx, dy] = delta;
    mover(posicion.x + dx * PASO_TECLADO, posicion.y + dy * PASO_TECLADO);
  }

  const estilo = flotante && posicion ? { left: `${posicion.x}px`, top: `${posicion.y}px` } : undefined;

  return (
    <div ref={caja} class={`mini mini--${modo}`} style={estilo} role="region" aria-label="Reproductor pequeño">
      {flotante && (
        <button
          type="button"
          class="mini__asa"
          aria-label="Mover reproductor"
          title="Arrastra o usa las flechas"
          onPointerDown={alPresionar}
          onPointerMove={alArrastrar}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          onKeyDown={alTeclear}
        >
          <Icono nombre="mover" />
        </button>
      )}
      <div class="mini__portada" aria-hidden="true" />
      <a class="mini__datos" href="#/musica">
        <span class="mini__titulo">{titulo}</span>
        <span class="mini__artista">{artista}</span>
      </a>
      <button type="button" class="mini__control" aria-label={sonando ? 'Pausar' : 'Reproducir'} onClick={alAlternar}>
        <Icono nombre={sonando ? 'pausa' : 'reproducir'} />
      </button>
    </div>
  );
}
