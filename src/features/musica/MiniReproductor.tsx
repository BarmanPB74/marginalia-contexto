import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { LadoEscondido } from '../../app/ajustes';
import { Icono } from '../../ui/Icono';
import { ladoParaEsconder, limitarPosicion } from './tiempo';
import './MiniReproductor.css';

export type ModoMini = 'anclado' | 'flotante' | 'en-linea';

interface Props {
  titulo: string;
  artista: string;
  sonando: boolean;
  alAlternar: () => void;
  /** anclado: sobre la barra inferior · flotante: arrastrable · en-linea: dentro del flujo (galería) */
  modo: ModoMini;
  /** Lado donde está escondido (solo queda una pestaña en el borde); `null` = visible. */
  escondido?: LadoEscondido;
  alEsconder?: (lado: LadoEscondido) => void;
  /** miniatura oficial de la canción (i.ytimg.com) */
  portada?: string | null;
}

/** Cuánto hay que deslizar el mini anclado de lado para esconderlo. */
const UMBRAL_DESLIZAR = 90;

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
export function MiniReproductor({
  titulo,
  artista,
  sonando,
  alAlternar,
  modo,
  escondido = null,
  alEsconder = () => undefined,
  portada = null,
}: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<{ x: number; y: number } | null>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  // Deslizar de lado el mini anclado: desde dónde empezó y cuánto se ha movido
  const deslizar = useRef<{ x0: number; movido: boolean } | null>(null);
  const [desvio, setDesvio] = useState(0);
  const flotante = modo === 'flotante';

  // Posición inicial del flotante: abajo a la derecha, justo encima de la barra
  useLayoutEffect(() => {
    if (!flotante || escondido || !caja.current) return;
    setPosicion((p) => limitar(p ?? { x: Infinity, y: Infinity }, caja.current as HTMLElement));
  }, [flotante, escondido]);

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

  function alSoltar(e: PointerEvent) {
    if (!arrastre.current) return;
    arrastre.current = null;
    // Lanzado contra un borde lateral (el dedo llega al canto): se esconde de ese lado.
    const lado = ladoParaEsconder(e.clientX, innerWidth);
    if (e.type === 'pointerup' && lado) alEsconder(lado);
  }

  // Mini anclado: deslizar de lado lo esconde; poco desplazamiento vuelve a su sitio.
  function alPresionarAnclado(e: PointerEvent) {
    if (modo !== 'anclado') return;
    deslizar.current = { x0: e.clientX, movido: false };
  }

  function alMoverAnclado(e: PointerEvent) {
    const d = deslizar.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.movido && Math.abs(dx) < 10) return;
    if (!d.movido) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    d.movido = true;
    setDesvio(dx);
  }

  function alSoltarAnclado() {
    const d = deslizar.current;
    if (!d) return;
    if (Math.abs(desvio) >= UMBRAL_DESLIZAR) alEsconder(desvio < 0 ? 'izquierda' : 'derecha');
    setDesvio(0);
    // El "click" que llega justo después de deslizar no debe abrir Música ni pausar.
    setTimeout(() => (deslizar.current = null), 0);
  }

  function alClicCaptura(e: MouseEvent) {
    if (deslizar.current?.movido) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  if (escondido) {
    // Pestaña en el borde: el globo sigue ahí, solo apartado. Un toque lo trae de vuelta.
    const arriba = flotante && posicion ? { top: `${posicion.y}px` } : undefined;
    return (
      <button
        type="button"
        class={`mini-pestana mini-pestana--${escondido}${flotante ? '' : ' mini-pestana--anclada'}`}
        style={arriba}
        aria-label={`Mostrar reproductor (${titulo})`}
        onClick={() => alEsconder(null)}
      >
        <span class={`mini-pestana__onda${sonando ? ' mini-pestana__onda--sonando' : ''}`} aria-hidden="true">
          <Icono nombre="musica" tamano={20} />
        </span>
      </button>
    );
  }

  function alTeclear(e: KeyboardEvent) {
    if (!posicion) return;
    const delta = FLECHAS[e.key];
    if (!delta) return;
    e.preventDefault();
    const [dx, dy] = delta;
    mover(posicion.x + dx * PASO_TECLADO, posicion.y + dy * PASO_TECLADO);
  }

  const estilo =
    flotante && posicion
      ? { left: `${posicion.x}px`, top: `${posicion.y}px` }
      : desvio
        ? { transform: `translateX(${desvio}px)`, opacity: String(1 - Math.min(Math.abs(desvio) / 260, 0.6)) }
        : undefined;

  return (
    <div
      ref={caja}
      class={`mini mini--${modo}${desvio ? ' mini--deslizando' : ''}`}
      style={estilo}
      role="region"
      aria-label="Reproductor pequeño"
      onPointerDown={alPresionarAnclado}
      onPointerMove={alMoverAnclado}
      onPointerUp={alSoltarAnclado}
      onPointerCancel={alSoltarAnclado}
      onClickCapture={alClicCaptura}
    >
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
      {portada ? (
        <img class="mini__portada" src={portada} alt="" referrerpolicy="no-referrer" />
      ) : (
        <div class="mini__portada" aria-hidden="true" />
      )}
      <a class="mini__datos" href="#/musica">
        <span class="mini__titulo">{titulo}</span>
        <span class="mini__artista">{artista}</span>
      </a>
      <button type="button" class="mini__control" aria-label={sonando ? 'Pausar' : 'Reproducir'} onClick={alAlternar}>
        <Icono nombre={sonando ? 'pausa' : 'reproducir'} />
      </button>
      {modo !== 'en-linea' && (
        <button
          type="button"
          class="mini__control mini__esconder"
          aria-label="Esconder reproductor a un lado"
          onClick={() => alEsconder(flotante && posicion && posicion.x < innerWidth / 2 - 100 ? 'izquierda' : 'derecha')}
        >
          <Icono nombre="esconder" />
        </button>
      )}
    </div>
  );
}
