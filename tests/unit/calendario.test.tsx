import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { diaEnRuta } from '../../src/app/rutas';
import { agenda, anteriores, notasPorDia } from '../../src/core/notas/fechas';
import type { Nota } from '../../src/core/notas/nota';
import { PantallaCalendario } from '../../src/features/calendario/PantallaCalendario';
import { boton, esperar, montar, repoNuevo } from './ayuda';

describe('ruta del día', () => {
  it('#/calendario/AAAA-MM-DD abre ese día; lo demás no', () => {
    expect(diaEnRuta('#/calendario/2026-10-12')).toBe('2026-10-12');
    expect(diaEnRuta('#/calendario/2026-02-30')).toBeNull();
    expect(diaEnRuta('#/calendario')).toBeNull();
    expect(diaEnRuta('#/notas/2026-10-12')).toBeNull();
  });
});

describe('PantallaCalendario', () => {
  it('pinta el mes desde el lunes, marca hoy y pone una raya por nota en su día', async () => {
    const repo = repoNuevo();
    const n = await repo.crear({ titulo: 'Entrega' });
    await repo.guardar({ ...n, cuerpo: 'Entregar @2026-10-12 y revisar @2026-10-20' });
    const c = await montar(<PantallaCalendario hoy="2026-10-05" />, repo);
    expect(c.querySelector('.calendario__nombre')?.textContent).toBe('Octubre de 2026');
    const celdas = [...c.querySelectorAll('.celda-dia')];
    expect(celdas).toHaveLength(42);
    expect(celdas[0]?.getAttribute('aria-label')).toBe('28'); // lunes 28 de septiembre
    expect(c.querySelector('.celda-dia--hoy')?.getAttribute('aria-label')).toBe('5, hoy');
    expect(celdas.filter((b) => b.getAttribute('aria-label')?.includes('1 nota')).map((b) => b.textContent)).toEqual([
      '12',
      '20',
    ]);
    expect(c.querySelectorAll('.calendario__agenda .calendario__nota')).toHaveLength(2);
  });

  it('las flechas cambian de mes y «Hoy» vuelve', async () => {
    const c = await montar(<PantallaCalendario hoy="2026-10-05" />, repoNuevo());
    act(() => boton(c, 'Mes siguiente').click());
    expect(c.querySelector('.calendario__nombre')?.textContent).toBe('Noviembre de 2026');
    act(() => boton(c, 'Mes anterior').click());
    act(() => boton(c, 'Mes anterior').click());
    expect(c.querySelector('.calendario__nombre')?.textContent).toBe('Septiembre de 2026');
    act(() => boton(c, 'Hoy').click());
    expect(c.querySelector('.calendario__nombre')?.textContent).toBe('Octubre de 2026');
  });

  it('tocar un día lo pone en la ruta; la hoja del día crea su bitácora con enlace a la fecha', async () => {
    const repo = repoNuevo();
    let c = await montar(<PantallaCalendario hoy="2026-10-05" />, repo);
    act(() => boton(c, '12').click());
    expect(location.hash).toBe('#/calendario/2026-10-12');

    c = await montar(<PantallaCalendario hoy="2026-10-05" dia="2026-10-12" />, repo);
    const hoja = c.querySelector('[role="dialog"]') as HTMLElement;
    expect(hoja.getAttribute('aria-label')).toBe('lunes, 12 de octubre de 2026');
    expect(hoja.textContent).toContain('Sin notas este día.');
    await act(async () => boton(hoja, 'Nueva bitácora').click());
    await esperar();
    const id = location.hash.replace('#/notas/', '');
    const nota = await repo.obtener(id);
    expect(nota?.titulo).toBe('Bitácora 2026-10-12');
    expect(nota?.cuerpo.startsWith('@2026-10-12')).toBe(true);
    expect(nota?.extra['fecha']).toBe('2026-10-12');
  });

  it('un enlace @fecha de otro mes salta a ese mes', async () => {
    const c = await montar(<PantallaCalendario hoy="2026-10-05" dia="2027-01-03" />, repoNuevo());
    expect(c.querySelector('.calendario__nombre')?.textContent).toBe('Enero de 2027');
  });
});

describe('agenda', () => {
  const n = (id: string, cuerpo: string): Nota => ({ id, titulo: id, creado: '', editado: '', etiquetas: [], extra: {}, cuerpo });
  const indice = notasPorDia([n('a', '@2026-10-01'), n('b', '@2026-10-05 y @2026-10-20'), n('c', '@2026-11-02')]);

  it('desde hoy en orden; los anteriores del más reciente al más antiguo', () => {
    expect(agenda(indice, '2026-10-05').map((d) => d.dia)).toEqual(['2026-10-05', '2026-10-20', '2026-11-02']);
    expect(anteriores(indice, '2026-10-05').map((d) => d.dia)).toEqual(['2026-10-01']);
  });

  it('la vista Agenda lista los próximos días y deja ver los anteriores', async () => {
    const repo = repoNuevo();
    for (const [t, c] of [['Pasada', '@2026-10-01'], ['Hoy toca', '@2026-10-05'], ['Futura', '@2026-12-24']] as const) {
      const x = await repo.crear({ titulo: t });
      await repo.guardar({ ...x, cuerpo: c });
    }
    const c = await montar(<PantallaCalendario hoy="2026-10-05" />, repo);
    const agendaBoton = [...c.querySelectorAll('[role="radio"]')].find((b) => b.textContent === 'Agenda') as HTMLButtonElement;
    act(() => agendaBoton.click());
    const titulos = () => [...c.querySelectorAll('.calendario__agenda--sola .calendario__nota')].map((a) => a.textContent);
    expect(titulos()).toEqual(['Hoy toca', 'Futura']);
    expect(c.querySelector('.calendario__agenda-dia--hoy')?.textContent).toMatch(/^Hoy · lunes, 5 de octubre/);
    act(() => boton(c, 'Ver días anteriores').click());
    expect(titulos()).toEqual(['Pasada', 'Hoy toca', 'Futura']);
  });
});

describe('rendimiento', () => {
  it('500 notas con fechas: el mes se pinta rápido (aceptación de F3)', async () => {
    const repo = repoNuevo();
    for (let i = 0; i < 500; i++) {
      const x = await repo.crear({ titulo: `N${i}` });
      await repo.guardar({ ...x, cuerpo: `@2026-10-${String((i % 28) + 1).padStart(2, '0')} #etiqueta${i % 7}` });
    }
    const inicio = performance.now();
    const c = await montar(<PantallaCalendario hoy="2026-10-05" />, repo);
    const ms = performance.now() - inicio;
    expect(c.querySelectorAll('.celda-dia__nota').length).toBeGreaterThan(28);
    expect(ms).toBeLessThan(3000);
  });
});
