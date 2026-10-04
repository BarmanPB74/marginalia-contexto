import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { rutaActual, SECCIONES } from '../../src/app/rutas';
import { BarraInferior } from '../../src/ui/BarraInferior';
import { EstadoVacio } from '../../src/ui/EstadoVacio';
import { Icono, NOMBRES_ICONO } from '../../src/ui/Icono';

let contenedor: HTMLElement | undefined;

function montar(vista: ComponentChild) {
  const nuevo = document.createElement('div');
  document.body.append(nuevo);
  act(() => render(vista, nuevo));
  contenedor = nuevo;
  return nuevo;
}

afterEach(() => {
  if (!contenedor) return;
  render(null, contenedor);
  contenedor.remove();
  contenedor = undefined;
});

describe('rutas', () => {
  it('cada sección tiene su hash y lo vacío o desconocido abre Notas', () => {
    expect(rutaActual('#/notas')).toBe('notas');
    expect(rutaActual('#/calendario')).toBe('calendario');
    expect(rutaActual('#/musica')).toBe('musica');
    expect(rutaActual('#/ajustes')).toBe('ajustes');
    expect(rutaActual('#/galeria')).toBe('galeria');
    expect(rutaActual('')).toBe('notas');
    expect(rutaActual('#/otra')).toBe('notas');
  });

  it('hay exactamente 4 secciones, en el orden de la barra', () => {
    expect(SECCIONES.map((s) => s.id)).toEqual(['notas', 'calendario', 'musica', 'ajustes']);
  });
});

describe('Icono', () => {
  it('cada icono es un SVG decorativo de trazo, sin relleno y con puntas redondas', () => {
    const c = montar(
      <div>
        {NOMBRES_ICONO.map((nombre) => (
          <Icono key={nombre} nombre={nombre} />
        ))}
      </div>,
    );
    const svgs = [...c.querySelectorAll('svg')];
    expect(svgs).toHaveLength(NOMBRES_ICONO.length);
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('stroke-linecap')).toBe('round');
      expect(svg.querySelectorAll('path, circle').length).toBeGreaterThan(0);
    }
  });
});

describe('BarraInferior', () => {
  it('es una navegación con 4 enlaces etiquetados y marca la sección actual', () => {
    const c = montar(<BarraInferior actual="musica" />);
    const nav = c.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Secciones');
    const enlaces = [...c.querySelectorAll('a')];
    expect(enlaces.map((a) => a.textContent)).toEqual(['Notas', 'Calendario', 'Música', 'Ajustes']);
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['#/notas', '#/calendario', '#/musica', '#/ajustes']);
    expect(enlaces.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent)).toEqual([
      'Música',
    ]);
  });
});

describe('EstadoVacio', () => {
  it('muestra un mensaje manuscrito y una pista secundaria', () => {
    const c = montar(<EstadoVacio mensaje="Aún no hay notas." pista="La primera aparecerá aquí." />);
    expect(c.querySelector('.estado-vacio__mensaje')?.textContent).toBe('Aún no hay notas.');
    expect(c.querySelector('.estado-vacio__pista')?.textContent).toBe('La primera aparecerá aquí.');
  });
});
