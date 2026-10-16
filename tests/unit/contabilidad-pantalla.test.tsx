import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { centavos, milesimas, pesos, type Negocio } from '../../src/core/negocio';
import { diaDe } from '../../src/core/notas/fechas';
import { PantallaContabilidad } from '../../src/features/contabilidad/PantallaContabilidad';
import { periodoDe } from '../../src/features/contabilidad/periodo';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { boton, esperar, montar, negocioDePrueba, repoNuevo } from './ayuda';

const $ = (p: number) => centavos(p * 100);
const u = (n: number) => milesimas(n * 1000);

/** Dueña con dos productos (uno con nombre hostil), caja abierta, tres ventas, un gasto y una factura vencida. */
async function conDatos(): Promise<Negocio> {
  const n = await negocioDePrueba();
  const cerveza = (await n.crearProducto({ nombre: 'Cerveza', categoria: 'Bebidas', unidad: 'unidad', precio: $(8500), costo: $(3000) })).id;
  const hostil = (await n.crearProducto({ nombre: '=HYPERLINK("x")', categoria: 'Otros', unidad: 'unidad', precio: $(1000) })).id;
  await n.abrirCaja($(50000));
  await n.vender({ lineas: [{ productoId: cerveza, cantidad: u(2) }], pagos: [{ forma: 'efectivo' }] });
  await n.vender({
    lineas: [{ productoId: cerveza, cantidad: u(1) }, { productoId: hostil, cantidad: u(1) }],
    pagos: [{ forma: 'tarjeta', monto: $(5000) }, { forma: 'transferencia' }],
  });
  await n.vender({ lineas: [{ productoId: hostil, cantidad: u(1) }], pagos: [{ forma: 'cortesia' }] });
  await n.registrarGasto({ categoria: 'Hielo', descripcion: 'Bolsas', monto: $(6000), forma: 'efectivo', deCaja: true });
  await n.registrarCompra({
    proveedor: 'Distribuidora',
    numero: 'F-1',
    fecha: '2026-01-02',
    vence: '2026-01-10',
    lineas: [{ productoId: cerveza, cantidad: u(10), costoUnit: $(3000) }],
  });
  return n;
}

async function abrir(n: Negocio) {
  return montar(
    <ProveedorNegocio>
      <PantallaContabilidad />
    </ProveedorNegocio>,
    repoNuevo(),
    n,
  );
}

const valorDe = (c: HTMLElement, etiqueta: string) => c.querySelector(`section.cifra[aria-label="${etiqueta}"] .cifra__valor`)?.textContent;

afterEach(() => vi.restoreAllMocks());

describe('Contabilidad', () => {
  it('las cifras son las de negocio.contabilidad y se avisa que no es contabilidad oficial', async () => {
    const n = await conDatos();
    const c = await abrir(n);
    const r = await n.contabilidad(periodoDe('hoy', new Date()));
    expect(r.ventas.cantidad).toBe(3);
    expect(c.textContent).toContain('Registro interno de apoyo. No es factura electrónica ni contabilidad oficial');
    expect(valorDe(c, 'Ventas netas')).toBe(pesos(r.ventas.netas));
    expect(valorDe(c, 'Ingreso real')).toBe(pesos(r.ventas.ingresoReal));
    expect(valorDe(c, 'Costo de ventas')).toBe(pesos(r.costoVentas));
    expect(valorDe(c, 'Margen')).toBe(pesos(r.margenBruto));
    expect(valorDe(c, 'Gastos')).toBe(pesos(r.gastos.total));
    expect(valorDe(c, 'Pagos a proveedores')).toBe(pesos(r.pagosProveedores.total));
    expect(valorDe(c, 'Cuentas por pagar')).toBe(pesos(r.totalPorPagar));
    // El costo es aproximado y lo dice; el producto sin costo se nombra
    expect(c.textContent).toContain('aproximado');
    expect(c.textContent).toContain('Sin costo, no suman: =HYPERLINK("x")');
    // Gráfico accesible con los datos + tabla equivalente
    const grafico = c.querySelector('[role="img"].grafico');
    expect(grafico?.getAttribute('aria-label')).toContain(`Efectivo ${pesos(r.ventas.porForma.efectivo)}`);
    expect(c.querySelector('caption')?.textContent).toBe('Ventas por forma de pago');
    // La factura vencida se marca
    expect(c.textContent).toContain('Distribuidora · F-1');
    expect(c.textContent).toContain('Vencida');
  });

  it('cambia de período y vuelve a pedir el resumen', async () => {
    const n = await conDatos();
    const c = await abrir(n);
    const espia = vi.spyOn(n, 'contabilidad');
    await act(() => boton(c, 'Mes').click());
    await esperar();
    expect(espia).toHaveBeenCalledWith(periodoDe('mes', new Date()));
    await act(() => boton(c, 'Rango').click());
    await esperar();
    expect(boton(c, /^Desde/)).toBeTruthy();
  });

  it('exporta el CSV con el nombre del día y sin fórmulas inyectadas', async () => {
    const n = await conDatos();
    const c = await abrir(n);
    const blobs: Blob[] = [];
    const nombres: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobs.push(b as Blob);
      return 'blob:prueba';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      nombres.push(this.download);
    });

    await act(() => boton(c, 'Exportar CSV (resumen)').click());
    await esperar();
    await act(() => boton(c, 'Exportar CSV (ventas)').click());
    await esperar();

    const hoy = diaDe(new Date());
    expect(nombres).toEqual([`barbox-contabilidad-${hoy}.csv`, `barbox-contabilidad-ventas-${hoy}.csv`]);
    const [resumen = '', ventas = ''] = await Promise.all(blobs.map((b) => b.text()));
    expect(resumen).toContain('Ventas;Netas;;');
    expect(ventas).toContain('Cerveza');
    for (const texto of [resumen, ventas]) {
      expect(texto).toContain(`'=HYPERLINK`);
      expect(texto).not.toMatch(/(^|;)=HYPERLINK/m);
    }
    expect(c.textContent).toContain('Descargas/barbox-contabilidad-ventas-');
  });

  it('«Verificar registro» recorre el diario', async () => {
    const n = await conDatos();
    const c = await abrir(n);
    await act(() => boton(c, 'Verificar registro').click());
    await esperar();
    const v = await n.verificar();
    expect(v.ok).toBe(true);
    expect(c.textContent).toContain(`Registro íntegro: ${v.eventos} movimientos.`);
  });

  it('un cajero no ve las cifras', async () => {
    const n = await conDatos();
    const ev = await n.crearUsuario({ nombre: 'Carlos', rol: 'cajero', pin: '5678' });
    expect((await n.iniciarSesion(ev.id, '5678')).ok).toBe(true);
    const c = await abrir(n);
    expect(c.textContent).toContain('Esta sección es del dueño.');
    expect(c.querySelector('.cifra')).toBeNull();
  });
});
