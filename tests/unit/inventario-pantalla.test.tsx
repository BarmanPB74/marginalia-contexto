import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { centavos, milesimas, Negocio, stockDe } from '../../src/core/negocio';
import { ProveedorNegocio } from '../../src/features/negocio/contexto';
import { PantallaInventario } from '../../src/features/inventario/PantallaInventario';
import { cuantosActivos, FILTROS_INICIALES, filasInventario, filtrar, limitesExistencias } from '../../src/features/inventario/filtros';
import { boton, esperar, montar, negocioDePrueba, repoNuevo, hastaQue } from './ayuda';

/** La pantalla dentro del proveedor del negocio (el de prueba lo inyecta `montar`). */
const Pantalla = () => (
  <ProveedorNegocio>
    <PantallaInventario />
  </ProveedorNegocio>
);

const $ = (p: number) => centavos(p * 100);
const u = (n: number) => milesimas(Math.round(n * 1000));

/** Negocio con dueña y cuatro productos: bajo, negativo, agotado y normal. */
async function conProductos(n?: Negocio) {
  const negocio = n ?? (await negocioDePrueba());
  const crear = async (nombre: string, categoria: string, stock: number, minimo: number | null = null) => {
    const id = (await negocio.crearProducto({ nombre, categoria, unidad: 'unidad', precio: $(5000), costo: $(2000), stockMinimo: minimo === null ? null : u(minimo) })).id;
    if (stock !== 0) await negocio.ajustarInventario({ productoId: id, delta: u(stock), motivo: 'correccion', nota: 'inicial' });
    return id;
  };
  const ids = {
    cafe: await crear('Café', 'Bebidas', 5, 10),
    cerveza: await crear('Cerveza', 'Bebidas', -2),
    queso: await crear('Queso', 'Cocina', 0),
    agua: await crear('Agua', 'Bebidas', 20, 3),
  };
  return { negocio, ids };
}

/** El elemento existe (sin `!`: la regla de lint lo prohíbe). */
function hay<T>(x: T | null | undefined): T {
  if (x === null || x === undefined) throw new Error('Falta un elemento en la pantalla');
  return x;
}

function campo(c: ParentNode, etiqueta: string): HTMLInputElement {
  const label = [...c.querySelectorAll('label')].find((l) => l.textContent?.trim() === etiqueta);
  const el = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!el) throw new Error(`No hay campo «${etiqueta}»`);
  return el as HTMLInputElement;
}

async function escribir(el: HTMLInputElement | HTMLSelectElement, valor: string, evento = 'input') {
  await act(async () => {
    el.value = valor;
    el.dispatchEvent(new Event(evento, { bubbles: true }));
  });
  await esperar();
}

async function tocar(el: HTMLElement) {
  await act(async () => el.click());
  await esperar();
}

const nombresTarjetas = (c: ParentNode) => [...c.querySelectorAll('.tarjeta-producto__nombre')].map((x) => x.textContent);

describe('inventario: filtros (puros)', () => {
  it('filtra por texto sin tildes, categoría, estado, existencias y archivados', async () => {
    const { negocio, ids } = await conProductos();
    await negocio.archivarProducto(ids.agua);
    const filas = filasInventario(negocio.estado);
    const nombres = (f: typeof FILTROS_INICIALES) => filtrar(filas, f).map((x) => x.producto.nombre);
    expect(nombres(FILTROS_INICIALES)).toEqual(['Café', 'Cerveza', 'Queso']);
    expect(nombres({ ...FILTROS_INICIALES, soloActivos: false })).toEqual(['Agua', 'Café', 'Cerveza', 'Queso']);
    expect(nombres({ ...FILTROS_INICIALES, busqueda: 'CAFE' })).toEqual(['Café']);
    expect(nombres({ ...FILTROS_INICIALES, categorias: ['Cocina'] })).toEqual(['Queso']);
    expect(nombres({ ...FILTROS_INICIALES, estados: ['negativo', 'bajo'] })).toEqual(['Café', 'Cerveza']);
    expect(nombres({ ...FILTROS_INICIALES, estados: ['agotado'] })).toEqual(['Queso']);
    expect(nombres({ ...FILTROS_INICIALES, existencias: [0, 5] })).toEqual(['Café', 'Queso']);
    expect(limitesExistencias(filas)).toEqual([-2, 20]);
    expect(cuantosActivos({ ...FILTROS_INICIALES, categorias: ['a'], estados: ['bajo'], soloActivos: false })).toBe(3);
  });
});

describe('Pantalla de Inventario', () => {
  it('muestra alertas, tarjetas y filtra con chips activos y «Limpiar todo»', async () => {
    const { negocio } = await conProductos();
    location.hash = '#/inventario';
    const c = await montar(<Pantalla />, repoNuevo(), negocio);
    expect(c.querySelector('h1')?.textContent).toBe('Inventario');
    expect(c.querySelector('.inv-alertas')?.textContent).toMatch(/1 con existencias negativas/);
    expect(c.querySelector('.inv-alertas')?.textContent).toMatch(/1 en el mínimo/);
    expect(nombresTarjetas(c)).toEqual(['Agua', 'Café', 'Cerveza', 'Queso']);

    await escribir(hay(c.querySelector<HTMLInputElement>('input[type=search]')), 'cafe');
    expect(nombresTarjetas(c)).toEqual(['Café']);
    await escribir(hay(c.querySelector<HTMLInputElement>('input[type=search]')), '');

    const casillaCocina = [...c.querySelectorAll<HTMLInputElement>('.casilla__entrada')].find((i) => i.closest('label')?.textContent?.startsWith('Cocina'));
    expect(casillaCocina?.closest('label')?.textContent).toBe('Cocina (1)');
    await tocar(hay(casillaCocina));
    expect(nombresTarjetas(c)).toEqual(['Queso']);
    expect(boton(c, 'Quitar filtro: Cocina')).toBeTruthy();
    expect(boton(c, /^Filtros \(1\)$/)).toBeTruthy();

    await tocar(boton(c, 'Limpiar todo'));
    expect(nombresTarjetas(c)).toHaveLength(4);

    await tocar(boton(c, /^Negativo/));
    expect(nombresTarjetas(c)).toEqual(['Cerveza']);
    expect(c.querySelector('.tarjeta-producto')?.textContent).toMatch(/-2 und \(negativo\)/);
    await tocar(boton(c, 'Quitar filtro: Negativo'));

    // Vista lista: tabla con costos para la dueña
    await tocar(boton(c, 'Ver en lista'));
    const encabezados = [...c.querySelectorAll('th')].map((t) => t.textContent);
    expect(encabezados).toContain('Costo');
    expect(c.querySelectorAll('tbody tr')).toHaveLength(4);
  });

  it('la ficha cuenta, registra merma y muestra el historial', async () => {
    const { negocio, ids } = await conProductos();
    location.hash = `#/inventario?producto=${ids.cafe}`;
    const c = await montar(<Pantalla />, repoNuevo(), negocio);
    expect(c.querySelector('h1')?.textContent).toBe('Café');
    expect(c.textContent).toMatch(/Bajo mínimo/);
    // Sugerido = mínimo 10 − existencia 5
    const sugerido = [...c.querySelectorAll('.cifra')].find((x) => x.textContent?.includes('Sugerido'));
    expect(sugerido?.textContent).toMatch(/5 und/);

    await tocar(boton(c, 'Contar'));
    await escribir(campo(c, '¿Cuántas hay?'), '7');
    expect(c.textContent).toMatch(/Diferencia: \+2 und/);
    await tocar(boton(c, 'Guardar conteo'));
    await hastaQue(() => stockDe(negocio.estado, ids.cafe) === 7000);
    expect(stockDe(negocio.estado, ids.cafe)).toBe(7000);

    await tocar(boton(c, 'Merma o corrección'));
    await escribir(campo(c, 'Cantidad que sale'), '2');
    await escribir(campo(c, 'Nota (opcional)'), 'se rompieron');
    await tocar(boton(c, 'Guardar ajuste'));
    await hastaQue(() => stockDe(negocio.estado, ids.cafe) === 5000);
    expect(stockDe(negocio.estado, ids.cafe)).toBe(5000);
    await hastaQue(() => /Merma: se rompieron/.test(c.querySelector('tbody tr')?.textContent ?? ''));
    const filas = [...c.querySelectorAll('tbody tr')].map((t) => t.textContent ?? '');
    expect(filas[0]).toMatch(/Merma: se rompieron.*-2 und.*Dueña/);
    expect(filas[1]).toMatch(/Conteo.*\+2 und/);

    // Corrección sin nota: la app la pide
    await tocar(boton(c, 'Merma o corrección'));
    await tocar(boton(c, 'Corrección'));
    await escribir(campo(c, 'Cantidad que sale'), '1');
    await tocar(boton(c, 'Guardar ajuste'));
    await hastaQue(() => c.querySelector('[role=alert]') !== null);
    expect(c.querySelector('[role=alert]')?.textContent).toMatch(/lleva nota/);
  });

  it('crea un producto con categoría sugerida', async () => {
    const { negocio } = await conProductos();
    location.hash = '#/inventario';
    const c = await montar(<Pantalla />, repoNuevo(), negocio);
    await tocar(hay(c.querySelector<HTMLButtonElement>('.boton-flotante')));
    await escribir(campo(c, 'Nombre'), 'Limonada');
    await tocar(boton(c, 'Bebidas'));
    expect(campo(c, 'Categoría').value).toBe('Bebidas');
    await escribir(campo(c, 'Precio de venta'), '6.500');
    await escribir(campo(c, 'Existencia mínima'), '4');
    await tocar(boton(c, 'Crear producto'));
    const p = Object.values(negocio.estado.productos).find((x) => x.nombre === 'Limonada');
    expect(p).toMatchObject({ categoria: 'Bebidas', precio: 650000, stockMinimo: 4000 });
    expect(location.hash).toBe(`#/inventario?producto=${p?.id}`);
  });

  it('el cajero ve el inventario sin costos ni acciones', async () => {
    const { negocio, ids } = await conProductos();
    const cajero = await negocio.crearUsuario({ nombre: 'Caja', rol: 'cajero', pin: '5678' });
    expect((await negocio.iniciarSesion(cajero.id, '5678')).ok).toBe(true);
    localStorage.setItem('stark.inventario.vista', 'lista');
    location.hash = '#/inventario';
    const c = await montar(<Pantalla />, repoNuevo(), negocio);
    expect([...c.querySelectorAll('th')].map((t) => t.textContent)).not.toContain('Costo');
    expect(c.querySelector('.boton-flotante')).toBeNull();
    expect(c.textContent).not.toMatch(/Importar/);
    expect(c.textContent).not.toMatch(/\$ 2\.000/);

    location.hash = `#/inventario?producto=${ids.cafe}`;
    await esperar();
    expect(c.querySelector('h1')?.textContent).toBe('Café');
    expect(c.textContent).not.toMatch(/Último costo|Margen/);
    expect(c.querySelector('[aria-label="Acciones del producto"]')?.textContent ?? '').toBe('');
  });
});

describe('Importar inventario', () => {
  it('lee el .xls que es una tabla, deja corregir y confirma: crea, ajusta y acepta negativos', async () => {
    const disco = new DiscoMemoria();
    const negocio = await Negocio.crear(crearAlmacen(disco), { iteracionesPin: 1000 });
    await negocio.crearUsuario({ nombre: 'Dueña', rol: 'dueno', pin: '1234' });
    const vasos = (await negocio.crearProducto({ nombre: 'Vasos desechables', categoria: 'Desechables', unidad: 'unidad', precio: $(0) })).id;
    await negocio.ajustarInventario({ productoId: vasos, delta: u(10), motivo: 'correccion', nota: 'x' });

    location.hash = '#/inventario?importar';
    const c = await montar(<Pantalla />, repoNuevo(), negocio);
    const entrada = hay(c.querySelector<HTMLInputElement>('input[type=file]'));
    expect(entrada.accept).toBe(
      '.xls,.xlsx,.csv,.txt,.html,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const bytes = new Uint8Array(readFileSync('tests/unit/fixtures/inventario-tabla.xls'));
    const archivo = new File([bytes], 'inventario-tabla.xls', { type: 'application/vnd.ms-excel' });
    await act(async () => {
      Object.defineProperty(entrada, 'files', { value: [archivo], configurable: true });
      entrada.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await esperar();
    await esperar();

    expect(c.querySelector('h1')?.textContent).toBe('Revisar importación');
    // El nombre del archivo se ve solo aquí, en la vista previa
    expect(c.textContent).toContain('inventario-tabla.xls');
    expect(campo(c, 'Nombre').value).toBe('1');
    expect(campo(c, 'Cantidad (existencia final)').value).toBe('3');
    expect(campo(c, 'Categoría').value).toBe('');
    expect(c.textContent).toMatch(/1\.234,50 \(coma decimal/);
    const cifra = (t: string) => [...c.querySelectorAll('.cifra')].find((x) => x.querySelector('.cifra__etiqueta')?.textContent === t)?.querySelector('.cifra__valor')?.textContent;
    expect(cifra('Crear')).toBe('7');
    expect(cifra('Ajustar')).toBe('1');
    expect(cifra('Filas con error')).toBe('2');

    // Corregir el mapeo: sin cantidad, la vista previa lo explica
    await escribir(campo(c, 'Cantidad (existencia final)'), '', 'change');
    expect(c.querySelector('[role=alert]')?.textContent).toMatch(/cantidad/i);
    await escribir(campo(c, 'Cantidad (existencia final)'), '3', 'change');
    // «Ubicación» no es categoría, pero la persona puede elegirla
    await escribir(campo(c, 'Categoría'), '0', 'change');
    expect(cifra('Crear')).toBe('7');

    await tocar(boton(c, 'Confirmar importación'));
    // Importar escribe un movimiento por producto: en una máquina cargada tarda más que unos ticks
    await hastaQue(() => c.querySelector('h1')?.textContent === 'Inventario importado');
    expect(c.querySelector('h1')?.textContent).toBe('Inventario importado');
    expect(c.textContent).not.toContain('inventario-tabla.xls');

    const porNombre = (n: string) => Object.values(negocio.estado.productos).find((p) => p.nombre === n);
    expect(stockDe(negocio.estado, vasos)).toBe(997000);
    expect(stockDe(negocio.estado, hay(porNombre('CAFÉ OSCURO')).id)).toBe(-2000);
    expect(stockDe(negocio.estado, hay(porNombre('Té Helado Limón')).id)).toBe(1234500);
    expect(porNombre('AGUA CON GAS')?.categoria).toBe('General');
    expect(Object.keys(negocio.estado.productos)).toHaveLength(8);

    // Ni el nombre del archivo ni su extensión quedan guardados en el diario
    const todo = (await Promise.all((await disco.listar('negocio')).map((f) => disco.leer(`negocio/${f}`)))).join('');
    const diario = (await Promise.all((await disco.listar('negocio/diario')).map((f) => disco.leer(`negocio/diario/${f}`)))).join('');
    expect(todo + diario).not.toMatch(/inventario-tabla|\.xls/);
    expect(diario).toMatch(/importacion/);
  });

  it('un archivo que no es tabla muestra un error legible', async () => {
    location.hash = '#/inventario?importar';
    const c = await montar(<Pantalla />, repoNuevo());
    const entrada = hay(c.querySelector<HTMLInputElement>('input[type=file]'));
    const binario = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])], 'viejo.xls');
    await act(async () => {
      Object.defineProperty(entrada, 'files', { value: [binario], configurable: true });
      entrada.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await esperar();
    expect(c.querySelector('[role=alert]')?.textContent).toMatch(/Excel antiguo.*\.xlsx o \.csv/);
    expect(c.textContent).not.toContain('viejo.xls');
  });
});
