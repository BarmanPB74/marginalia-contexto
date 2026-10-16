import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { milesimas } from '../../src/core/negocio/numeros';
import {
  buscarFilaEncabezado,
  detectarColumnas,
  ErrorImportacion,
  filasImportables,
  leerTabla,
  planImportacion,
  type FilaImportable,
  type ProductoExistente,
} from '../../src/core/negocio/importar';

const fixture = (nombre: string) => new Uint8Array(readFileSync(`tests/unit/fixtures/${nombre}`));

describe('filasImportables: inventario en tabla HTML', () => {
  const tabla = leerTabla(fixture('inventario-tabla.xls'), 'inventario.xls');
  const fe = buscarFilaEncabezado(tabla);
  const mapeo = detectarColumnas(tabla[fe] ?? []);
  const { filas, errores, convencion } = filasImportables(tabla, mapeo, { filaEncabezado: fe });

  it('convierte cantidades «Final» a milésimas enteras, con negativos y miles', () => {
    expect(convencion).toBe('es-CO');
    expect(filas.map((f) => [f.nombre, f.cantidad, f.filaOriginal])).toEqual([
      ['AGUA CON GAS', 23_000, 2],
      ['Limonada de Coco Grande', 8_500, 3],
      ['CAFÉ OSCURO', -2_000, 4],
      ['Vasos desechables', 997_000, 5],
      ['Piña Colada Ñapa', 3_000, 6],
      ['Té Helado Limón', 1_234_500, 7],
      ['Cerveza Artesanal Rubia', 40_000, 8],
      ['Hielo en bolsa', 0, 9],
    ]);
    for (const f of filas) {
      expect(Number.isInteger(f.cantidad)).toBe(true);
      expect(f.categoria).toBeUndefined(); // «Ubicación» no es categoría
    }
  });

  it('salta vacías y totales; informa números inválidos y repetidos', () => {
    expect(errores).toEqual([
      { fila: 10, motivo: '«Maní salado»: la cantidad «abc» no es un número válido.' },
      { fila: 11, motivo: '«agua con gas» está repetido (ya está en la fila 2); se ignora esta fila.' },
    ]);
  });
});

describe('filasImportables: casos', () => {
  it('CSV con código, categoría y precio: dinero a centavos enteros', () => {
    const tabla = leerTabla(fixture('inventario-puntoycoma.csv'), 'inventario.csv');
    const { filas, errores } = filasImportables(tabla, detectarColumnas(tabla[0] ?? []));
    expect(errores).toEqual([]);
    expect(filas).toEqual([
      { nombre: 'Sándwich "Especial"', cantidad: 12_000, precio: 1_250_000, categoria: 'Comidas', codigo: 'A-01', filaOriginal: 2 },
      { nombre: 'Empanada; de carne', cantidad: 1_500, precio: 300_000, categoria: 'Comidas', codigo: 'A-02', filaOriginal: 3 },
      { nombre: 'Jugo de mora', cantidad: -3_000, precio: 450_050, categoria: 'Bebidas', codigo: 'A-03', filaOriginal: 4 },
    ]);
  });

  it('sin pistas, los ambiguos se leen como colombianos; se puede forzar la convención', () => {
    const tabla = [
      ['Nombre', 'Cantidad', 'Precio'],
      ['Ron', '1.500', '12.000'],
    ];
    const co = filasImportables(tabla, { nombre: 0, cantidad: 1, precio: 2 });
    expect(co.convencion).toBe('es-CO');
    expect(co.filas[0]).toMatchObject({ cantidad: 1_500_000, precio: 1_200_000 });
    const en = filasImportables(tabla, { nombre: 0, cantidad: 1, precio: 2 }, { convencion: 'en' });
    expect(en.filas[0]).toMatchObject({ cantidad: 1_500, precio: 1_200 });
    // Con pistas anglosajonas en el mismo archivo
    const deducida = filasImportables([...tabla, ['Gin', '2.5', '10.25']], { nombre: 0, cantidad: 1, precio: 2 });
    expect(deducida.convencion).toBe('en');
    expect(deducida.filas[0]).toMatchObject({ cantidad: 1_500, precio: 1_200 });
  });

  it('nombres largos se recortan a 120; precio negativo, sin nombre o sin cantidad → error', () => {
    const tabla = [
      ['Producto', 'Stock', 'Precio', 'Unidad'],
      ['x'.repeat(300), '1', '', 'botella'],
      ['Vino', '2', '-5', ''],
      ['', '3', '', ''],
      ['Gin', '', '', ''],
      ['Producto', 'Stock', 'Precio', 'Unidad'], // encabezado repetido (reporte paginado)
      ['Subtotal bebidas', '6', '', ''],
      ['Gran total', '6', '', ''],
    ];
    const { filas, errores } = filasImportables(tabla, detectarColumnas(tabla[0] ?? []));
    expect(filas).toHaveLength(1);
    expect(filas[0]?.nombre).toHaveLength(120);
    expect(filas[0]?.unidad).toBe('botella');
    expect(filas[0]?.precio).toBeUndefined();
    expect(errores.map((e) => e.fila)).toEqual([3, 4, 5]);
    expect(errores[0]?.motivo).toMatch(/precio «-5»/);
    expect(errores[1]?.motivo).toMatch(/Sin nombre/);
    expect(errores[2]?.motivo).toMatch(/sin cantidad/);
  });

  it('repetidos por código también se avisan', () => {
    const tabla = [
      ['Código', 'Nombre', 'Final'],
      ['7701', 'Agua', '1'],
      ['7701', 'Agua grande', '2'],
    ];
    const { filas, errores } = filasImportables(tabla, detectarColumnas(tabla[0] ?? []));
    expect(filas).toHaveLength(1);
    expect(errores[0]?.motivo).toMatch(/código «7701» está repetido/);
  });

  it('cantidades y precios fuera de los topes del negocio → error de fila', () => {
    const tabla = [
      ['Nombre', 'Final', 'Precio'],
      ['Ron', '1.000.001', ''],
      ['Gin', '-1.000.001', ''],
      ['Vino', '1', '100.000.000,01'],
      ['Agua', '1.000.000', '100.000.000'],
    ];
    const { filas, errores } = filasImportables(tabla, detectarColumnas(tabla[0] ?? []));
    expect(errores.map((e) => e.fila)).toEqual([2, 3, 4]);
    expect(filas).toEqual([{ nombre: 'Agua', cantidad: 1_000_000_000, precio: 10_000_000_000, filaOriginal: 5 }]);
  });

  it('sin columna de nombre o de cantidad → ErrorImportacion', () => {
    expect(() => filasImportables([['a']], { cantidad: 0 })).toThrow(ErrorImportacion);
    expect(() => filasImportables([['a']], { nombre: 0 })).toThrow(/cantidad/);
    expect(() => filasImportables([['a']], { nombre: 0, cantidad: 99 })).toThrow(/no existe/);
  });
});

describe('planImportacion', () => {
  const fila = (nombre: string, cantidad: number, extra: Partial<FilaImportable> = {}): FilaImportable => ({
    nombre,
    cantidad: milesimas(cantidad),
    filaOriginal: 2,
    ...extra,
  });
  const existentes: ProductoExistente[] = [
    { id: 'p1', nombre: 'Agua con gas', cantidad: milesimas(10_000) },
    { id: 'p2', nombre: 'Café oscuro' },
    { id: 'p3', nombre: 'Ron añejo', codigo: 'R-7', cantidad: milesimas(4_000) },
  ];
  const filas = [
    fila('AGUA  CON   GAS', 23_000),
    fila('cafe OSCURO', -2_000),
    fila('Ron viejo de la casa', 5_000, { codigo: ' r-7 ' }),
    fila('Ginebra', 1_500),
  ];

  it('fijar: empareja por nombre normalizado o código; la cantidad es la existencia final', () => {
    expect(planImportacion(existentes, filas, 'fijar')).toEqual([
      { tipo: 'ajustar', modo: 'fijar', productoId: 'p1', nombre: 'Agua con gas', antes: 10_000, objetivo: 23_000, fila: filas[0] },
      { tipo: 'ajustar', modo: 'fijar', productoId: 'p2', nombre: 'Café oscuro', objetivo: -2_000, fila: filas[1] },
      { tipo: 'ajustar', modo: 'fijar', productoId: 'p3', nombre: 'Ron añejo', antes: 4_000, objetivo: 5_000, fila: filas[2] },
      { tipo: 'crear', fila: filas[3] },
    ]);
  });

  it('sumar: la cantidad importada es un delta', () => {
    const plan = planImportacion(existentes, filas, 'sumar');
    expect(plan[0]).toEqual({
      tipo: 'ajustar',
      modo: 'sumar',
      productoId: 'p1',
      nombre: 'Agua con gas',
      antes: 10_000,
      delta: 23_000,
      fila: filas[0],
    });
    expect(plan.map((a) => a.tipo)).toEqual(['ajustar', 'ajustar', 'ajustar', 'crear']);
  });

  it('sin productos existentes todo es crear; un producto no se ajusta dos veces', () => {
    expect(planImportacion([], filas, 'fijar').every((a) => a.tipo === 'crear')).toBe(true);
    const dos = [fila('Otro nombre', 1, { codigo: 'R-7' }), fila('Ron Añejo', 2)];
    expect(planImportacion(existentes, dos, 'fijar')).toHaveLength(1);
  });
});
