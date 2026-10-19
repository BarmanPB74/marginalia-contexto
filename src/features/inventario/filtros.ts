/**
 * Filtros de la pantalla de Inventario (puros: se prueban sin pantalla).
 */
import { stockDe, type EstadoNegocio, type Milesimas, type Producto } from '../../core/negocio';
import { estadoStock, normal, type EstadoStock } from './comun';

export type EstadoFiltro = Exclude<EstadoStock, 'ok'>;
export const ESTADOS_FILTRO: readonly EstadoFiltro[] = ['negativo', 'agotado', 'bajo'];

export interface Filtros {
  busqueda: string;
  categorias: readonly string[];
  /** Rango de existencias en unidades enteras; null = sin filtro. */
  existencias: readonly [number, number] | null;
  estados: readonly EstadoFiltro[];
  soloActivos: boolean;
}

export const FILTROS_INICIALES: Filtros = { busqueda: '', categorias: [], existencias: null, estados: [], soloActivos: true };

export interface FilaInventario {
  readonly producto: Producto;
  readonly stock: Milesimas;
  readonly estado: EstadoStock;
}

/** Productos con su existencia y estado, ordenados por nombre. */
export function filasInventario(estado: EstadoNegocio): FilaInventario[] {
  return Object.values(estado.productos)
    .map((p) => {
      const stock = stockDe(estado, p.id);
      // Descontinuado: sus existencias no son una alerta (no se vuelve a pedir)
      return { producto: p, stock, estado: p.descontinuado ? 'ok' : estadoStock(stock, p.stockMinimo) };
    })
    .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es'));
}

/** Cuántos filtros hay puestos (la búsqueda no cuenta: se ve en su campo). */
export function cuantosActivos(f: Filtros): number {
  return f.categorias.length + f.estados.length + (f.existencias ? 1 : 0) + (f.soloActivos ? 0 : 1);
}

/** Aplica todos los filtros. La búsqueda mira nombre, categoría y código, sin tildes. */
export function filtrar(filas: readonly FilaInventario[], f: Filtros): FilaInventario[] {
  const q = normal(f.busqueda);
  const categorias = new Set(f.categorias);
  const estados = new Set<EstadoStock>(f.estados);
  return filas.filter(({ producto: p, stock, estado }) => {
    if (f.soloActivos && !p.activo) return false;
    if (q && !normal(`${p.nombre} ${p.categoria} ${p.codigo ?? ''}`).includes(q)) return false;
    if (categorias.size > 0 && !categorias.has(p.categoria)) return false;
    if (estados.size > 0 && !estados.has(estado)) return false;
    if (f.existencias) {
      const [min, max] = f.existencias;
      if (stock < min * 1000 || stock > max * 1000) return false;
    }
    return true;
  });
}

/** Categorías con cuántos productos tienen (de las filas dadas), por nombre. */
export function contarCategorias(filas: readonly FilaInventario[]): [string, number][] {
  const n = new Map<string, number>();
  for (const { producto } of filas) n.set(producto.categoria, (n.get(producto.categoria) ?? 0) + 1);
  return [...n].sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

/** Límites del rango de existencias, en unidades enteras (incluye el 0 y los negativos). */
export function limitesExistencias(filas: readonly FilaInventario[]): [number, number] {
  let min = 0;
  let max = 0;
  for (const { stock } of filas) {
    min = Math.min(min, Math.floor(stock / 1000));
    max = Math.max(max, Math.ceil(stock / 1000));
  }
  return [min, Math.max(max, min + 1)];
}
