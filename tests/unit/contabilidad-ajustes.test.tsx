import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PantallaAjustes } from '../../src/features/ajustes/PantallaAjustes';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { diaDe } from '../../src/core/notas/fechas';
import { boton, esperar, montar, negocioDePrueba, repoNuevo } from './ayuda';

afterEach(() => vi.restoreAllMocks());

describe('Ajustes → Datos del negocio', () => {
  it('mantiene lo de antes y añade exportar, verificar y la explicación de privacidad', async () => {
    const n = await negocioDePrueba();
    const c = await montar(
      <ProveedorNegocio>
        <PantallaAjustes />
      </ProveedorNegocio>,
      repoNuevo(),
      n,
    );
    for (const texto of ['Tema', 'Exportar notas (ZIP)', 'Datos del negocio', 'Sin internet', 'Keystore']) {
      expect(c.textContent).toContain(texto);
    }
    const nombres: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nombres.push(this.download);
    });
    await act(() => boton(c, 'Exportar contabilidad completa (CSV)').click());
    await esperar();
    expect(nombres).toEqual([`stark-contabilidad-${diaDe(new Date())}.csv`]);
    await act(() => boton(c, 'Verificar registro').click());
    await esperar();
    expect(c.textContent).toContain('Registro íntegro: 1 movimiento.');
  });

  it('un cajero no ve los botones del dueño, sí la explicación', async () => {
    const n = await negocioDePrueba();
    const ev = await n.crearUsuario({ nombre: 'Carlos', rol: 'cajero', pin: '5678' });
    await n.iniciarSesion(ev.id, '5678');
    const c = await montar(
      <ProveedorNegocio>
        <PantallaAjustes />
      </ProveedorNegocio>,
      repoNuevo(),
      n,
    );
    expect(c.textContent).toContain('Datos del negocio');
    expect(() => boton(c, 'Verificar registro')).toThrow();
    expect(() => boton(c, 'Exportar contabilidad completa (CSV)')).toThrow();
  });

  it('sin negocio abierto (pruebas antiguas) la sección no aparece', async () => {
    const c = await montar(<PantallaAjustes />, repoNuevo());
    expect(c.textContent).toContain('Tema');
    expect(c.textContent).not.toContain('Datos del negocio');
  });
});
