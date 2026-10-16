import { limpiarCelda, sinTildes } from './texto';
import type { CampoImportable, MapeoColumnas, Tabla } from './tipos';

/**
 * Sinónimos de encabezado por campo, ya normalizados (sin tildes, minúsculas, sin signos).
 * El orden importa: si dos columnas sirven para el mismo campo, gana la de sinónimo más arriba
 * (p. ej. con «Inicial» y «Final», la cantidad es «Final»; «Inicial» y «Diferencia» se ignoran).
 * «Ubicación» y «Bodega» NO son categoría: dicen dónde está el producto, no qué es.
 */
const SINONIMOS: Readonly<Record<CampoImportable, readonly string[]>> = {
  nombre: ['nombre', 'nombre producto', 'nombre del producto', 'producto', 'descripcion', 'articulo', 'item'],
  cantidad: [
    'inventario final',
    'existencia final',
    'existencias finales',
    'saldo final',
    'stock final',
    'cantidad final',
    'final',
    'existencia',
    'existencias',
    'stock',
    'saldo',
    'cantidad',
    'cant',
  ],
  precio: ['precio venta', 'precio de venta', 'pvp', 'valor venta', 'valor de venta', 'precio'],
  costo: ['costo', 'costo unitario', 'precio compra', 'precio de compra', 'valor compra', 'costo promedio'],
  categoria: ['categoria', 'grupo', 'linea', 'familia'],
  codigo: ['codigo', 'sku', 'referencia', 'ref', 'plu', 'codigo de barras', 'cod'],
  unidad: ['unidad', 'um', 'unidad de medida', 'medida'],
};

const CAMPOS: readonly CampoImportable[] = ['nombre', 'cantidad', 'precio', 'costo', 'categoria', 'codigo', 'unidad'];

/** «&nbsp;&nbsp;Precio venta ($):» → «precio venta»; «P.V.P.» → «pvp» (los puntos de sigla se quitan). */
export function normalizarEncabezado(texto: string): string {
  return sinTildes(texto.replace(/\u00a0/g, ' ').replace(/\./g, ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Propone qué columna alimenta cada campo, comparando encabezados con los sinónimos (coincidencia
 * exacta tras normalizar). Una columna no se asigna a dos campos. Los campos sin columna quedan
 * fuera del objeto.
 */
export function detectarColumnas(encabezados: readonly string[]): MapeoColumnas {
  const normalizados = encabezados.map(normalizarEncabezado);
  const usadas = new Set<number>();
  const mapeo: MapeoColumnas = {};
  for (const campo of CAMPOS) {
    const sinonimos = SINONIMOS[campo];
    let mejor = -1;
    let mejorRango = Infinity;
    normalizados.forEach((h, i) => {
      if (usadas.has(i)) return;
      const rango = sinonimos.indexOf(h);
      if (rango >= 0 && rango < mejorRango) {
        mejor = i;
        mejorRango = rango;
      }
    });
    if (mejor >= 0) {
      mapeo[campo] = mejor;
      usadas.add(mejor);
    }
  }
  return mapeo;
}

/**
 * Busca la fila de encabezados entre las primeras 30 (algunos reportes traen un título encima):
 * la primera donde se reconozcan nombre y cantidad; si no, la primera con nombre; si no, la 0.
 */
export function buscarFilaEncabezado(tabla: Tabla): number {
  const limite = Math.min(tabla.length, 30);
  let soloNombre = -1;
  for (let i = 0; i < limite; i++) {
    const m = detectarColumnas(tabla[i] ?? []);
    if (m.nombre !== undefined && m.cantidad !== undefined) return i;
    if (m.nombre !== undefined && soloNombre < 0) soloNombre = i;
  }
  return soloNombre >= 0 ? soloNombre : 0;
}

export interface Columna {
  /** Índice desde 0 (el que va en `MapeoColumnas`). */
  indice: number;
  /** Encabezado limpio, o «Columna B» si está vacío. */
  titulo: string;
  /** Hasta 3 valores de ejemplo de las filas siguientes, para ayudar a elegir. */
  ejemplos: string[];
}

/** Letra de columna al estilo de Excel: 0 → A, 26 → AA. */
export function letraColumna(indice: number): string {
  let s = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Lista de columnas para que la persona corrija el mapeo en la UI. */
export function listarColumnas(tabla: Tabla, filaEncabezado = 0): Columna[] {
  const ancho = tabla.reduce((m, f) => Math.max(m, f.length), 0);
  const encabezados = tabla[filaEncabezado] ?? [];
  const cuerpo = tabla.slice(filaEncabezado + 1);
  return Array.from({ length: ancho }, (_, indice) => ({
    indice,
    titulo: limpiarCelda(encabezados[indice] ?? '') || `Columna ${letraColumna(indice)}`,
    ejemplos: cuerpo
      .map((f) => f[indice] ?? '')
      .filter((v) => v !== '')
      .slice(0, 3),
  }));
}
