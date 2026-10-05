import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { PantallaNota } from '../../src/features/notas/PantallaNota';
import { boton, esperar, montar, repoNuevo } from './ayuda';

describe('exportar una nota', () => {
  it('Exportar → Texto descarga el archivo descifrado y avisa dónde quedó', async () => {
    const repo = repoNuevo();
    const n = await repo.crear({ titulo: 'Diario' });
    await repo.guardar({ ...n, cuerpo: '**hola** mundo' });
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => (blobs.push(b as Blob), 'blob:x'));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const c = await montar(<PantallaNota id={n.id} />, repo);
    act(() => boton(c, 'Exportar').click());
    const hoja = c.querySelector('[role="dialog"]') as HTMLElement;
    expect(hoja.getAttribute('aria-label')).toBe('Exportar sin cifrar');
    await act(async () => boton(hoja, 'Texto (.txt)').click());
    await esperar();

    expect(clic).toHaveBeenCalledOnce();
    expect(await blobs[0]?.text()).toBe('Diario\n======\n\nhola mundo\n');
    expect(c.querySelector('.nota__aviso')?.textContent).toBe('Exportada sin cifrar en Descargas/Diario.txt');
    expect(c.querySelector('[role="dialog"]')).toBeNull();
    vi.restoreAllMocks();
  });
});
