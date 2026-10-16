import { describe, expect, it } from 'vitest';
import {
  buscarFilaEncabezado,
  detectarColumnas,
  letraColumna,
  listarColumnas,
  normalizarEncabezado,
} from '../../src/core/negocio/importar';

describe('detectarColumnas', () => {
  it('inventario con Ubicación/Nombre/Inicial/Final/Diferencia: cantidad = Final, ubicación ignorada', () => {
    const m = detectarColumnas(['Ubicación', '\u00a0\u00a0\u00a0Nombre', '   Inicial', '   Final', '   Diferencia']);
    expect(m).toEqual({ nombre: 1, cantidad: 3 });
  });

  it('sinónimos sin tildes ni mayúsculas', () => {
    expect(
      detectarColumnas(['CÓDIGO', 'Descripción', 'Línea', 'Existencias', 'P.V.P.', 'Precio de compra', 'U.M.']),
    ).toEqual({ codigo: 0, nombre: 1, categoria: 2, cantidad: 3, precio: 4, costo: 5, unidad: 6 });
    expect(detectarColumnas(['SKU', 'Artículo', 'Familia', 'Stock', 'Valor venta', 'Costo unitario', 'Unidad'])).toEqual({
      codigo: 0,
      nombre: 1,
      categoria: 2,
      cantidad: 3,
      precio: 4,
      costo: 5,
      unidad: 6,
    });
    expect(detectarColumnas(['PLU', 'Item', 'Grupo', 'Saldo', 'Precio'])).toEqual({
      codigo: 0,
      nombre: 1,
      categoria: 2,
      cantidad: 3,
      precio: 4,
    });
  });

  it('bodega no es categoría; «precio compra» no se confunde con precio de venta', () => {
    expect(detectarColumnas(['Bodega', 'Producto', 'Cantidad', 'Precio compra'])).toEqual({
      nombre: 1,
      cantidad: 2,
      costo: 3,
    });
  });

  it('si hay varias candidatas gana la de mejor sinónimo (nombre > descripción, final > cantidad)', () => {
    expect(detectarColumnas(['Descripción', 'Nombre', 'Cantidad', 'Inventario final'])).toEqual({
      nombre: 1,
      cantidad: 3,
    });
  });

  it('sin coincidencias → objeto vacío', () => {
    expect(detectarColumnas(['a', 'b', ''])).toEqual({});
  });

  it('normalizarEncabezado', () => {
    expect(normalizarEncabezado('\u00a0 Precio  venta ($):')).toBe('precio venta');
  });
});

describe('buscarFilaEncabezado y listarColumnas', () => {
  const tabla = [
    ['Reporte de inventario'],
    [],
    ['Ubicación', 'Nombre', 'Final', ''],
    ['General', 'Agua', '3,00', 'x'],
    ['General', 'Café', '1,00'],
  ];

  it('encuentra el encabezado bajo un título', () => {
    expect(buscarFilaEncabezado(tabla)).toBe(2);
    expect(buscarFilaEncabezado([['a'], ['b']])).toBe(0);
  });

  it('lista columnas con título, letra si está vacío y ejemplos', () => {
    expect(listarColumnas(tabla, 2)).toEqual([
      { indice: 0, titulo: 'Ubicación', ejemplos: ['General', 'General'] },
      { indice: 1, titulo: 'Nombre', ejemplos: ['Agua', 'Café'] },
      { indice: 2, titulo: 'Final', ejemplos: ['3,00', '1,00'] },
      { indice: 3, titulo: 'Columna D', ejemplos: ['x'] },
    ]);
    expect([0, 25, 26, 51, 701, 702].map(letraColumna)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA']);
  });
});
