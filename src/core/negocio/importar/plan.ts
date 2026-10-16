import { normalizarCodigo, normalizarNombre } from './texto';
import type { FilaImportable, Milesimas } from './tipos';

/** Producto que ya existe en la app (lo mínimo para emparejar). */
export interface ProductoExistente {
  id: string;
  nombre: string;
  codigo?: string;
  /** Existencia actual; si se da, el plan la muestra como «antes». */
  cantidad?: Milesimas;
}

/**
 * - `fijar`: la cantidad importada ES la existencia final (conteo físico / inventario del sistema anterior).
 * - `sumar`: la cantidad importada se SUMA a la existencia (p. ej. una compra).
 */
export type ModoImportacion = 'fijar' | 'sumar';

interface AjusteBase {
  tipo: 'ajustar';
  productoId: string;
  /** Nombre del producto existente (como está en la app). */
  nombre: string;
  antes?: Milesimas;
  /** La fila importada (para actualizar precio, costo, etc. si se quiere). */
  fila: FilaImportable;
}

export type AccionImportacion =
  | { tipo: 'crear'; fila: FilaImportable }
  | (AjusteBase & { modo: 'fijar'; objetivo: Milesimas })
  | (AjusteBase & { modo: 'sumar'; delta: Milesimas });

/**
 * Plan puro de la importación, para mostrarlo y confirmarlo antes de aplicar nada.
 * Empareja cada fila con un producto existente primero por código (si ambos lo tienen) y luego
 * por nombre normalizado (sin tildes, mayúsculas ni espacios dobles). Sin pareja → `crear`.
 * Si dos filas apuntan al mismo producto, solo cuenta la primera (las filas ya vienen sin
 * repetidos de `filasImportables`; esto solo pasa si una empareja por código y otra por nombre).
 * Si hay productos existentes con el mismo nombre normalizado, se usa el primero.
 */
export function planImportacion(
  existentes: readonly ProductoExistente[],
  filas: readonly FilaImportable[],
  modo: ModoImportacion,
): AccionImportacion[] {
  const porNombre = new Map<string, ProductoExistente>();
  const porCodigo = new Map<string, ProductoExistente>();
  for (const p of existentes) {
    const n = normalizarNombre(p.nombre);
    if (!porNombre.has(n)) porNombre.set(n, p);
    if (p.codigo) {
      const c = normalizarCodigo(p.codigo);
      if (c && !porCodigo.has(c)) porCodigo.set(c, p);
    }
  }

  const usados = new Set<string>();
  const acciones: AccionImportacion[] = [];
  for (const fila of filas) {
    const porCod = fila.codigo ? porCodigo.get(normalizarCodigo(fila.codigo)) : undefined;
    const producto = porCod ?? porNombre.get(normalizarNombre(fila.nombre));
    if (!producto) {
      acciones.push({ tipo: 'crear', fila });
      continue;
    }
    if (usados.has(producto.id)) continue;
    usados.add(producto.id);
    const base: AjusteBase = { tipo: 'ajustar', productoId: producto.id, nombre: producto.nombre, fila };
    if (producto.cantidad !== undefined) base.antes = producto.cantidad;
    acciones.push(
      modo === 'fijar' ? { ...base, modo, objetivo: fila.cantidad } : { ...base, modo, delta: fila.cantidad },
    );
  }
  return acciones;
}
