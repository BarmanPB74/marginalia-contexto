import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { diaEnRuta } from '../../src/app/rutas';
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
