import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { formatearTiempo, ladoParaEsconder, limitarPosicion } from '../../src/features/musica/tiempo';
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
    expect(c.querySelector('.estado-vacio')?.textContent).toContain('Nada sonando');
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

describe('esconder el globo de música a un lado', () => {
  it('ladoParaEsconder: solo al soltar pegado al canto', () => {
    expect(ladoParaEsconder(5, 390)).toBe('izquierda');
    expect(ladoParaEsconder(386, 390)).toBe('derecha');
    expect(ladoParaEsconder(200, 390)).toBeNull();
  });

  it('el botón lo esconde, queda una pestaña y un toque lo trae de vuelta (y se recuerda)', () => {
    location.hash = '#/notas';
    let c = montar(<App />);
    act(() => (c.querySelector('button[aria-label="Esconder reproductor a un lado"]') as HTMLButtonElement).click());
    expect(c.querySelector('.mini')).toBeNull();
    const pestana = c.querySelector('.mini-pestana') as HTMLButtonElement;
    expect(pestana.getAttribute('aria-label')).toMatch(/^Mostrar reproductor/);
    expect(c.querySelector('.con-mini-anclado')).toBeNull();

    // Al volver a abrir la app sigue escondido
    render(null, c);
    c.remove();
    c = montar(<App />);
    act(() => (c.querySelector('.mini-pestana') as HTMLButtonElement).click());
    expect(c.querySelector('.mini--anclado')).not.toBeNull();
    expect(c.querySelector('.mini-pestana')).toBeNull();
  });
});

describe('tema', () => {
  it('Ajustes → Oscuro marca <html> y se recuerda; Sistema lo quita', () => {
    location.hash = '#/ajustes';
    const c = montar(<App />);
    const opcion = (nombre: string) =>
      [...c.querySelectorAll('[role="radiogroup"][aria-label="Tema"] [role="radio"]')].find(
        (b) => b.textContent === nombre,
      ) as HTMLButtonElement;
    act(() => opcion('Oscuro').click());
    expect(document.documentElement.dataset['tema']).toBe('oscuro');
    expect(opcion('Oscuro').getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('marginalia.ajustes.v1')).toContain('oscuro');
    act(() => opcion('Sistema').click());
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });
});

describe('Música con YouTube Music', () => {
  const GUARDADA = [
    { clave: 'dQw4w9WgXcQ', enlace: { video: 'dQw4w9WgXcQ' }, titulo: 'Tema guardado', artista: 'Alguien' },
  ];

  it('con una canción guardada: reproductor oficial sin cookies dentro del dibujo, y el mini la muestra', () => {
    localStorage.setItem('marginalia.canciones.v1', JSON.stringify(GUARDADA));
    location.hash = '#/musica';
    let c = montar(<App />);
    const marco = c.querySelector('iframe');
    expect(marco?.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    expect(c.querySelector('.reproductor .video-oficial')).not.toBeNull();
    expect(c.querySelector('.reproductor__titulo')?.textContent).toBe('Tema guardado');
    expect(c.querySelector('a[href^="https://music.youtube.com/watch?v=dQw4w9WgXcQ"]')).not.toBeNull();
    render(null, c);
    c.remove();

    location.hash = '#/notas';
    c = montar(<App />);
    expect(c.querySelector('.mini__titulo')?.textContent).toBe('Tema guardado');
    expect(c.querySelector('img.mini__portada')?.getAttribute('src')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    expect(c.querySelector('iframe')).toBeNull(); // fuera de Música no hay audio escondido
    act(() => (c.querySelector('button[aria-label="Reproducir"]') as HTMLButtonElement).click());
    expect(location.hash).toBe('#/musica');
  });

  it('un enlace que no es de YouTube se rechaza con una pista', () => {
    location.hash = '#/musica';
    const c = montar(<App />);
    const entrada = c.querySelector('input[aria-label="Enlace de YouTube Music"]') as HTMLInputElement;
    act(() => {
      entrada.value = 'https://evil.com/watch?v=dQw4w9WgXcQ';
      entrada.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      (c.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
    });
    expect(c.querySelector('[role="alert"]')?.textContent).toContain('no parece un enlace');
    expect(c.querySelector('iframe')).toBeNull();
  });
});
