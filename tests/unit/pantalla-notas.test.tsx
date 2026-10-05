import { render, type ComponentChild } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { idNotaEnRuta, rutaActual } from '../../src/app/rutas';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { RepositorioNotas } from '../../src/core/notas/repositorio';
import { ProveedorNotas } from '../../src/features/notas/contexto';
import { ESPERA_GUARDADO, PantallaNota } from '../../src/features/notas/PantallaNota';
import { PantallaNotas } from '../../src/features/notas/PantallaNotas';

const ID = '01J9ZK3Q8V2M4N6P7R8S9T0WXY';
let contenedor: HTMLElement | undefined;

async function montar(vista: ComponentChild, repo: RepositorioNotas) {
  const nuevo = document.createElement('div');
  document.body.append(nuevo);
  contenedor = nuevo;
  await act(async () => {
    render(<ProveedorNotas value={repo}>{vista}</ProveedorNotas>, nuevo);
  });
  await esperar();
  return nuevo;
}

/** Deja correr las promesas pendientes (lecturas del repositorio) y re-renderiza. */
async function esperar() {
  for (let i = 0; i < 5; i++) await act(async () => await new Promise((r) => setTimeout(r, 0)));
}

function repoNuevo() {
  return new RepositorioNotas(crearAlmacen(new DiscoMemoria()));
}

function boton(c: HTMLElement, texto: string) {
  const b = [...c.querySelectorAll('button')].find((x) => x.textContent === texto);
  if (!b) throw new Error(`No hay botón «${texto}»`);
  return b;
}

function campo(c: HTMLElement, selector: string) {
  const el = c.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!el) throw new Error(`No hay ${selector}`);
  return el;
}

function escribir(campo: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  if (contenedor) {
    render(null, contenedor);
    contenedor.remove();
    contenedor = undefined;
  }
  location.hash = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('rutas de notas', () => {
  it('#/notas/<id> abre esa nota dentro de la sección Notas', () => {
    expect(rutaActual(`#/notas/${ID}`)).toBe('notas');
    expect(idNotaEnRuta(`#/notas/${ID}`)).toBe(ID);
  });

  it.each(['#/notas', '#/notas/', '#/notas/../ajustes', `#/notas/${ID}/x`, `#/calendario/${ID}`, '#/notas/hola'])(
    '%j no abre ninguna nota',
    (hash) => expect(idNotaEnRuta(hash)).toBeNull(),
  );
});

describe('PantallaNotas', () => {
  it('sin notas muestra el estado vacío y la acción Nueva', async () => {
    const c = await montar(<PantallaNotas />, repoNuevo());
    expect(c.querySelector('.estado-vacio__mensaje')?.textContent).toBe('Aún no hay notas.');
    expect(boton(c, 'Nueva')).toBeTruthy();
  });

  it('Nueva → elegir plantilla crea la nota y la abre', async () => {
    const repo = repoNuevo();
    const c = await montar(<PantallaNotas />, repo);
    act(() => boton(c, 'Nueva').click());
    const opciones = [...c.querySelectorAll('.selector-plantilla__lista button')].map((b) => b.textContent);
    expect(opciones).toEqual(['En blanco', 'Nota rápida', 'Bitácora', 'Reunión']);
    act(() => boton(c, 'Reunión').click());
    await esperar();
    const { notas } = await repo.listar();
    expect(notas).toHaveLength(1);
    expect(notas[0]?.etiquetas).toEqual(['reunión']);
    expect(location.hash).toBe(`#/notas/${notas[0]?.id}`);
  });

  it('Cancelar cierra el selector sin crear nada', async () => {
    const repo = repoNuevo();
    const c = await montar(<PantallaNotas />, repo);
    act(() => boton(c, 'Nueva').click());
    act(() => boton(c, 'Cancelar').click());
    expect(c.querySelector('.selector-plantilla')).toBeNull();
    expect((await repo.listar()).notas).toEqual([]);
  });

  it('muestra el árbol: subpáginas debajo de su madre y con más sangría', async () => {
    const repo = repoNuevo();
    const madre = await repo.crear({ titulo: 'Francés' });
    await repo.crear({ titulo: 'Subjuntivo', padre: madre.id });
    await repo.crear({ titulo: 'Alemán' });
    const c = await montar(<PantallaNotas />, repo);
    const filas = [...c.querySelectorAll<HTMLLIElement>('.lista-notas li')];
    expect(filas.map((f) => f.textContent)).toEqual(['Alemán', 'Francés', 'Subjuntivo']);
    expect(filas.map((f) => f.style.getPropertyValue('--nivel'))).toEqual(['0', '0', '1']);
    expect(filas[2]?.querySelector('a')?.getAttribute('href')).toBe(`#/notas/${(await repo.listar()).notas.find((n) => n.titulo === 'Subjuntivo')?.id}`);
  });

  it('avisa de archivos dañados sin esconder las notas buenas', async () => {
    const disco = new DiscoMemoria();
    const repo = new RepositorioNotas(crearAlmacen(disco));
    await repo.crear({ titulo: 'Buena' });
    await disco.escribir(`notas/${ID}.md`, 'basura');
    const c = await montar(<PantallaNotas />, repo);
    expect(c.querySelectorAll('.lista-notas li')).toHaveLength(1);
    expect(c.querySelector('.lista-notas__aviso')?.textContent).toContain('1 archivo no se pudo leer');
  });

  it('un título con HTML se muestra como texto, no se interpreta', async () => {
    const repo = repoNuevo();
    await repo.crear({ titulo: '<img src=x onerror="alert(1)">' });
    const c = await montar(<PantallaNotas />, repo);
    expect(c.querySelector('.lista-notas img')).toBeNull();
    expect(c.querySelector('.lista-notas a')?.textContent).toBe('<img src=x onerror="alert(1)">');
  });
});

describe('PantallaNota', () => {
  it('una nota que no existe lo dice y ofrece volver', async () => {
    const c = await montar(<PantallaNota id={ID} />, repoNuevo());
    expect(c.textContent).toContain('Esta nota no existe.');
    expect(c.querySelector('a[href="#/notas"]')).toBeTruthy();
  });

  it('autoguarda título y cuerpo tras dejar de escribir', async () => {
    const repo = repoNuevo();
    const nota = await repo.crear({ titulo: 'Inicial' });
    const c = await montar(<PantallaNota id={nota.id} />, repo);
    vi.useFakeTimers();
    act(() => escribir(campo(c, '.nota__titulo'), 'Nuevo título'));
    act(() => escribir(campo(c, '.nota__cuerpo'), '# Hola\n\n**negrita**'));
    expect(c.querySelector('[role="status"]')?.textContent).toBe('Guardando…');
    expect((await repo.obtener(nota.id))?.cuerpo).toBe('');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESPERA_GUARDADO);
    });
    vi.useRealTimers();
    await esperar();
    const guardada = await repo.obtener(nota.id);
    expect(guardada?.titulo).toBe('Nuevo título');
    expect(guardada?.cuerpo).toBe('# Hola\n\n**negrita**');
    expect(c.querySelector('[role="status"]')?.textContent).toBe('Guardado');
  });

  it('al salir de la nota guarda lo pendiente sin esperar', async () => {
    const repo = repoNuevo();
    const nota = await repo.crear({ titulo: 'x' });
    const c = await montar(<PantallaNota id={nota.id} />, repo);
    act(() => escribir(campo(c, '.nota__cuerpo'), 'escrito justo antes de salir'));
    act(() => render(null, c));
    await esperar();
    expect((await repo.obtener(nota.id))?.cuerpo).toBe('escrito justo antes de salir');
  });

  it('si Android manda la app a segundo plano, guarda', async () => {
    const repo = repoNuevo();
    const nota = await repo.crear({ titulo: 'x' });
    const c = await montar(<PantallaNota id={nota.id} />, repo);
    act(() => escribir(campo(c, '.nota__cuerpo'), 'antes de cambiar de app'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await esperar();
    expect((await repo.obtener(nota.id))?.cuerpo).toBe('antes de cambiar de app');
  });

  it('muestra la página madre y crea subpáginas desde una plantilla', async () => {
    const repo = repoNuevo();
    const madre = await repo.crear({ titulo: 'Francés' });
    const hija = await repo.crear({ titulo: 'Verbos', padre: madre.id });
    const c = await montar(<PantallaNota id={hija.id} />, repo);
    expect(c.querySelector(`.nota__ruta a[href="#/notas/${madre.id}"]`)?.textContent).toBe('Francés');
    act(() => boton(c, 'Subpágina').click());
    act(() => boton(c, 'Bitácora').click());
    await esperar();
    const nieta = (await repo.listar()).notas.find((n) => n.padre === hija.id);
    expect(nieta?.etiquetas).toEqual(['bitácora']);
    expect(location.hash).toBe(`#/notas/${nieta?.id}`);
  });

  it('borrar pide confirmación; si se cancela no borra nada', async () => {
    const repo = repoNuevo();
    const nota = await repo.crear({ titulo: 'Conservar' });
    const c = await montar(<PantallaNota id={nota.id} />, repo);
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => boton(c, 'Borrar nota').click());
    await esperar();
    expect(confirmar).toHaveBeenCalledWith('¿Borrar «Conservar»? Sus subpáginas pasan al nivel de arriba.');
    expect(await repo.obtener(nota.id)).not.toBeNull();
  });

  it('borrar confirmado elimina la nota y vuelve a su madre', async () => {
    const repo = repoNuevo();
    const madre = await repo.crear({ titulo: 'Madre' });
    const hija = await repo.crear({ titulo: 'Hija', padre: madre.id });
    location.hash = `#/notas/${hija.id}`;
    const c = await montar(<PantallaNota id={hija.id} />, repo);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => boton(c, 'Borrar nota').click());
    await esperar();
    expect(await repo.obtener(hija.id)).toBeNull();
    expect(location.hash).toBe(`#/notas/${madre.id}`);
  });
});

describe('Volver', () => {
  it('sube un nivel: de una subpágina a su madre y de ahí a la lista', async () => {
    const repo = repoNuevo();
    const madre = await repo.crear({ titulo: 'Madre' });
    const hija = await repo.crear({ titulo: 'Hija', padre: madre.id });
    const c = await montar(<PantallaNota id={hija.id} />, repo);
    const volver = c.querySelector<HTMLButtonElement>('button[aria-label="Volver"]');
    act(() => volver?.click());
    expect(location.hash).toBe(`#/notas/${madre.id}`);

    render(null, c);
    const d = await montar(<PantallaNota id={madre.id} />, repo);
    act(() => d.querySelector<HTMLButtonElement>('button[aria-label="Volver"]')?.click());
    expect(location.hash).toBe('#/notas');
  });
});
