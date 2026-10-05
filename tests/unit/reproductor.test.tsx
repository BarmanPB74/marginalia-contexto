import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { formatearTiempo, limitarPosicion } from '../../src/features/musica/tiempo';
import { MiniReproductor } from '../../src/features/musica/MiniReproductor';
import { Reproductor } from '../../src/features/musica/Reproductor';

let contenedor: HTMLElement | undefined;

function montar(vista: ComponentChild) {
  const nuevo = document.createElement('div');
  document.body.append(nuevo);
  act(() => render(vista, nuevo));
  contenedor = nuevo;
  return nuevo;
}

afterEach(() => {
  if (contenedor) {
    render(null, contenedor);
    contenedor.remove();
    contenedor = undefined;
  }
  location.hash = '';
});

const CANCION = { titulo: 'Canción de ejemplo', artista: 'Artista inventado', posicion: 84, duracion: 235 };

describe('formatearTiempo', () => {
  it('escribe minutos:segundos, y horas solo si hacen falta', () => {
    expect(formatearTiempo(0)).toBe('0:00');
    expect(formatearTiempo(84)).toBe('1:24');
    expect(formatearTiempo(3725)).toBe('1:02:05');
  });

  it('redondea hacia abajo y nunca da negativos', () => {
    expect(formatearTiempo(59.9)).toBe('0:59');
    expect(formatearTiempo(-3)).toBe('0:00');
  });
});

describe('limitarPosicion', () => {
  const pantalla = { ancho: 390, alto: 844, reservaInferior: 64 };
  const caja = { ancho: 200, alto: 64 };

  it('deja la posición si cabe', () => {
    expect(limitarPosicion({ x: 50, y: 300 }, caja, pantalla)).toEqual({ x: 50, y: 300 });
  });

  it('no deja salir por ningún borde (margen de 8 px) ni tapar la barra inferior', () => {
    expect(limitarPosicion({ x: -100, y: -100 }, caja, pantalla)).toEqual({ x: 8, y: 8 });
    expect(limitarPosicion({ x: 999, y: 999 }, caja, pantalla)).toEqual({ x: 390 - 200 - 8, y: 844 - 64 - 64 - 8 });
  });

  it('tampoco se mete bajo la barra de estado de Android', () => {
    expect(limitarPosicion({ x: 50, y: 0 }, caja, { ...pantalla, reservaSuperior: 32 })).toEqual({ x: 50, y: 40 });
  });
});

describe('Reproductor', () => {
  it('tiene los tres controles con nombre y anuncia el progreso', () => {
    const c = montar(<Reproductor {...CANCION} sonando={false} alAlternar={() => undefined} />);
    const nombres = [...c.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(nombres).toEqual(['Anterior', 'Reproducir', 'Siguiente']);
    const progreso = c.querySelector('[role="progressbar"][aria-label="Progreso"]');
    expect(progreso?.getAttribute('aria-valuetext')).toBe('1:24 de 3:55');
    expect(c.textContent).toContain('−2:31');
  });

  it('el botón central alterna entre reproducir y pausar', () => {
    const alAlternar = vi.fn();
    const c = montar(<Reproductor {...CANCION} sonando alAlternar={alAlternar} />);
    const central = c.querySelector('button[aria-label="Pausar"]') as HTMLButtonElement;
    act(() => central.click());
    expect(alAlternar).toHaveBeenCalledOnce();
  });
});

describe('MiniReproductor', () => {
  it('anclado: sin asa, con enlace a Música y botón de pausa', () => {
    const c = montar(<MiniReproductor {...CANCION} modo="anclado" sonando alAlternar={() => undefined} />);
    expect(c.querySelector('button[aria-label="Mover reproductor"]')).toBeNull();
    expect(c.querySelector('a')?.getAttribute('href')).toBe('#/musica');
    expect(c.querySelector('button[aria-label="Pausar"]')).not.toBeNull();
  });

  it('flotante: el asa se mueve con las flechas del teclado', () => {
    const c = montar(<MiniReproductor {...CANCION} modo="flotante" sonando={false} alAlternar={() => undefined} />);
    const mini = c.querySelector('.mini') as HTMLElement;
    const asa = c.querySelector('button[aria-label="Mover reproductor"]') as HTMLButtonElement;
    const izquierdaAntes = parseFloat(mini.style.left);
    act(() => {
      asa.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    act(() => {
      asa.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(parseFloat(mini.style.left)).toBeLessThan(izquierdaAntes);
  });
});

describe('preferencia de reproductor flotante', () => {
  it('por defecto el mini va anclado; en Música no aparece (allí está el grande)', () => {
    location.hash = '#/notas';
    let c = montar(<App />);
    expect(c.querySelector('.mini--anclado')).not.toBeNull();
    render(null, c);
    c.remove();
    location.hash = '#/musica';
    c = montar(<App />);
    expect(c.querySelector('.mini')).toBeNull();
    expect(c.querySelector('.reproductor')).not.toBeNull();
  });

  it('el interruptor de Ajustes lo vuelve flotante', () => {
    location.hash = '#/ajustes';
    const c = montar(<App />);
    const interruptor = c.querySelector('[role="switch"]') as HTMLElement;
    expect(interruptor.textContent).toContain('Reproductor flotante');
    act(() => interruptor.click());
    expect(c.querySelector('.mini--flotante')).not.toBeNull();
    expect(c.querySelector('.mini--anclado')).toBeNull();
  });
});
