import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useEstado } from '../../app/estado';
import type { LadoEscondido } from '../../app/ajustes';
import { Icono } from '../../ui/Icono';
import { ladoParaEsconder, limitarPosicion } from './tiempo';
import { VideoOficial } from './VideoOficial';
import './CapaVideo.css';

/** El hueco que Música reserva para el reproductor (lo pinta `Reproductor`). */
export const ID_HUECO = 'hueco-video';

/** Ventana flotante: visor de 264 × 200 (YouTube pide ≥ 200 × 200) + barra para moverla encima. */
const ANCHO = 264;
const ALTO_VIDEO = 200;
const ALTO_BARRA = 48;

export type ModoCapa = 'musica' | 'flotante';

interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

function reservaInferior(): number {
  return document.querySelector('.barra-inferior')?.getBoundingClientRect().height ?? 0;
}

function reservaSuperior(): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')) || 0;
}

function limitar(punto: { x: number; y: number }) {
  return limitarPosicion(
    punto,
    { ancho: ANCHO, alto: ALTO_VIDEO + ALTO_BARRA },
    { ancho: innerWidth, alto: innerHeight, reservaInferior: reservaInferior(), reservaSuperior: reservaSuperior() },
  );
}

/**
 * Un solo reproductor oficial para toda la app (ADR-012, opción B del autor). No se mueve de
 * sitio en el DOM —moverlo recargaría el iframe y cortaría la canción—: solo cambia su caja.
 * - En Música se coloca exactamente sobre el hueco del reproductor dibujado.
 * - Fuera de Música, si estaba sonando, queda como ventana flotante arrastrable.
 * Reglas de YouTube (LEGAL §1): visor ≥ 200 × 200, siempre visible mientras suena y NADA delante
 * (por eso va por encima de todo, y la barra para moverla queda fuera del video). Esconderla a un
 * lado la pausa; cerrarla la quita.
 */
export function CapaVideo({ modo }: { modo: ModoCapa }) {
  const e = useEstado();
  const actual = e.cancion;
  const [caja, setCaja] = useState<Caja | null>(null);
  const [posicion, setPosicion] = useState<{ x: number; y: number } | null>(null);
  const [escondida, setEscondida] = useState<LadoEscondido>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);

  // En Música: seguir al hueco (desplazamiento, giro, cambios de tamaño)
  useLayoutEffect(() => {
    if (modo !== 'musica') return;
    let cuadro = 0;
    const medir = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const hueco = document.getElementById(ID_HUECO);
        const r = hueco?.getBoundingClientRect();
        setCaja(r && r.width > 0 ? { x: r.left, y: r.top, ancho: r.width, alto: r.height } : null);
      });
    };
    medir();
    addEventListener('scroll', medir, { passive: true });
    addEventListener('resize', medir);
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    const hueco = document.getElementById(ID_HUECO);
    if (hueco) observador?.observe(hueco);
    // El hueco puede aparecer un instante después (la pantalla de Música aún se monta)
    const reintento = setInterval(medir, 250);
    return () => {
      cancelAnimationFrame(cuadro);
      clearInterval(reintento);
      removeEventListener('scroll', medir);
      removeEventListener('resize', medir);
      observador?.disconnect();
    };
  }, [modo, actual?.clave]);

  // Flotante: abajo a la derecha, encima de la barra; si la pantalla cambia, se vuelve a meter
  useLayoutEffect(() => {
    if (modo !== 'flotante') return;
    setEscondida(null);
    setPosicion((p) => limitar(p ?? { x: Infinity, y: Infinity }));
    const alRedimensionar = () => setPosicion((p) => (p ? limitar(p) : p));
    addEventListener('resize', alRedimensionar);
    return () => removeEventListener('resize', alRedimensionar);
  }, [modo]);

  useEffect(() => {
    if (modo === 'musica') setEscondida(null);
  }, [modo]);

  if (!actual) return null;

  function esconder(lado: Exclude<LadoEscondido, null>) {
    // Escondida no se ve: no puede sonar (LEGAL §1)
    e.control.current?.pausar();
    e.alCambiarVideo({ sonando: false });
    setEscondida(lado);
  }

  function cerrar() {
    e.control.current?.pausar();
    e.cerrarFlotante();
  }

  const flotante = modo === 'flotante';
  const estilo = flotante
    ? posicion
      ? { left: `${posicion.x}px`, top: `${posicion.y}px`, width: `${ANCHO}px` }
      : { visibility: 'hidden' }
    : caja
      ? { left: `${caja.x}px`, top: `${caja.y}px`, width: `${caja.ancho}px`, height: `${caja.alto}px` }
      : { visibility: 'hidden' };

  return (
    <>
      <div
        class={`capa-video capa-video--${modo}${escondida ? ' capa-video--escondida' : ''}`}
        style={estilo}
        role="region"
        aria-label="Reproductor de YouTube"
        aria-hidden={escondida ? 'true' : undefined}
      >
        {flotante && (
          <div class="capa-video__barra">
            <button
              type="button"
              class="capa-video__asa"
              aria-label="Mover reproductor"
              title="Arrastra para moverlo"
              onPointerDown={(ev) => {
                if (!posicion) return;
                (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                arrastre.current = { dx: ev.clientX - posicion.x, dy: ev.clientY - posicion.y };
              }}
              onPointerMove={(ev) => {
                if (arrastre.current) setPosicion(limitar({ x: ev.clientX - arrastre.current.dx, y: ev.clientY - arrastre.current.dy }));
              }}
              onPointerUp={(ev) => {
                if (!arrastre.current) return;
                arrastre.current = null;
                const lado = ladoParaEsconder(ev.clientX, innerWidth);
                if (lado) esconder(lado);
              }}
              onPointerCancel={() => (arrastre.current = null)}
            >
              <Icono nombre="mover" />
            </button>
            <a class="capa-video__titulo" href="#/musica">
              {e.info.titulo ?? actual.titulo}
            </a>
            <button
              type="button"
              class="capa-video__boton"
              aria-label="Esconder reproductor a un lado (se pausa)"
              onClick={() => esconder(posicion && posicion.x < innerWidth / 2 - ANCHO / 2 ? 'izquierda' : 'derecha')}
            >
              <Icono nombre="esconder" />
            </button>
            <button type="button" class="capa-video__boton" aria-label="Cerrar reproductor" onClick={cerrar}>
              ×
            </button>
          </div>
        )}
        <div class="capa-video__visor" style={flotante ? { height: `${ALTO_VIDEO}px` } : undefined}>
          <VideoOficial
            key={`${actual.clave}-${e.eleccion.vez}`}
            enlace={{ ...actual.enlace, ...(e.eleccion.inicio ? { inicio: e.eleccion.inicio } : {}) }}
            alCambiar={e.alCambiarVideo}
            control={e.control}
          />
        </div>
      </div>
      {flotante && escondida && (
        <button
          type="button"
          class={`mini-pestana mini-pestana--${escondida}`}
          style={posicion ? { top: `${posicion.y}px` } : undefined}
          aria-label={`Mostrar reproductor (${actual.titulo})`}
          onClick={() => setEscondida(null)}
        >
          <Icono nombre="musica" tamano={20} />
        </button>
      )}
    </>
  );
}
