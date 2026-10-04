import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Boton } from '../../src/ui/Boton';
import { CampoTexto } from '../../src/ui/CampoTexto';
import { CeldaDia } from '../../src/ui/CeldaDia';
import { Encabezado } from '../../src/ui/Encabezado';
import { Etiqueta } from '../../src/ui/Etiqueta';
import { Interruptor } from '../../src/ui/Interruptor';
import { Pagina } from '../../src/ui/Pagina';
import { Tarjeta } from '../../src/ui/Tarjeta';

let contenedor: HTMLElement;

function montar(vista: ComponentChild) {
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  act(() => render(vista, contenedor));
  return contenedor;
}

afterEach(() => {
  render(null, contenedor);
  contenedor.remove();
});

describe('Pagina y Encabezado', () => {
  it('la página es el <main> y el encabezado lleva un único h1', () => {
    const c = montar(
      <Pagina>
        <Encabezado titulo="Notas" />
      </Pagina>,
    );
    expect(c.querySelector('main.pagina')).not.toBeNull();
    expect(c.querySelectorAll('h1')).toHaveLength(1);
    expect(c.querySelector('h1')?.textContent).toBe('Notas');
  });

  it('el encabezado admite como mucho una acción', () => {
    const alTocar = vi.fn();
    const c = montar(<Encabezado titulo="Notas" accion={{ etiqueta: 'Nueva', alTocar }} />);
    const botones = c.querySelectorAll('button');
    expect(botones).toHaveLength(1);
    act(() => botones[0]?.click());
    expect(alTocar).toHaveBeenCalledOnce();
  });
});

describe('Boton', () => {
  it('es un <button type="button"> con la variante como clase', () => {
    const c = montar(<Boton variante="texto">Cancelar</Boton>);
    const boton = c.querySelector('button');
    expect(boton?.type).toBe('button');
    expect(boton?.classList.contains('boton--texto')).toBe(true);
  });

  it('por defecto es de contorno y no responde si está desactivado', () => {
    const alTocar = vi.fn();
    const c = montar(
      <Boton desactivado alTocar={alTocar}>
        Guardar
      </Boton>,
    );
    const boton = c.querySelector('button');
    expect(boton?.classList.contains('boton--contorno')).toBe(true);
    act(() => boton?.click());
    expect(alTocar).not.toHaveBeenCalled();
  });
});

describe('Tarjeta y Etiqueta', () => {
  it('la tarjeta envuelve su contenido', () => {
    const c = montar(<Tarjeta>hola</Tarjeta>);
    expect(c.querySelector('.tarjeta')?.textContent).toBe('hola');
  });

  it('la etiqueta de canción usa la variante de acento', () => {
    const c = montar(<Etiqueta tipo="cancion">♪ Canción · 1:24</Etiqueta>);
    expect(c.querySelector('.etiqueta')?.classList.contains('etiqueta--cancion')).toBe(true);
  });
});

describe('CampoTexto', () => {
  it('la etiqueta visible está asociada al campo', () => {
    const c = montar(<CampoTexto etiqueta="Título" valor="" alCambiar={() => undefined} />);
    const input = c.querySelector('input');
    const label = c.querySelector('label');
    expect(input?.id).toBeTruthy();
    expect(label?.htmlFor).toBe(input?.id);
  });

  it('avisa de cada cambio con el texto nuevo', () => {
    const alCambiar = vi.fn();
    const c = montar(<CampoTexto etiqueta="Título" valor="" alCambiar={alCambiar} />);
    const input = c.querySelector('input');
    if (!input) throw new Error('sin input');
    input.value = 'Hola';
    act(() => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(alCambiar).toHaveBeenCalledWith('Hola');
  });
});

describe('Interruptor', () => {
  it('es un switch accesible que refleja su estado y lo invierte al tocarlo', () => {
    const alCambiar = vi.fn();
    const c = montar(<Interruptor etiqueta="Modo lectura" activo={false} alCambiar={alCambiar} />);
    const boton = c.querySelector('[role="switch"]');
    expect(boton?.getAttribute('aria-checked')).toBe('false');
    expect(boton?.textContent).toContain('Modo lectura');
    act(() => (boton as HTMLElement).click());
    expect(alCambiar).toHaveBeenCalledWith(true);
  });
});

describe('CeldaDia', () => {
  it('anuncia el día, si es hoy y cuántas notas tiene', () => {
    const c = montar(<CeldaDia dia={12} hoy notas={2} />);
    const celda = c.querySelector('button');
    expect(celda?.textContent).toContain('12');
    expect(celda?.getAttribute('aria-current')).toBe('date');
    expect(celda?.getAttribute('aria-label')).toBe('12, hoy, 2 notas');
    expect(c.querySelectorAll('.celda-dia__nota')).toHaveLength(2);
  });

  it('muestra como mucho 3 marcas aunque haya más notas', () => {
    const c = montar(<CeldaDia dia={3} notas={7} />);
    expect(c.querySelectorAll('.celda-dia__nota')).toHaveLength(3);
    expect(c.querySelector('button')?.getAttribute('aria-label')).toBe('3, 7 notas');
  });

  it('un día sin notas no lleva marcas y uno de otro mes se atenúa', () => {
    const c = montar(<CeldaDia dia={30} notas={0} fuera />);
    expect(c.querySelectorAll('.celda-dia__nota')).toHaveLength(0);
    expect(c.querySelector('button')?.classList.contains('celda-dia--fuera')).toBe(true);
    expect(c.querySelector('button')?.getAttribute('aria-label')).toBe('30');
  });
});
