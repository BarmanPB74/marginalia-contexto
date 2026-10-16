import {
  aplicarDescuento,
  centavos,
  importe,
  leerDinero,
  milesimas,
  stockDe,
  type Centavos,
  type Descuento,
  type EstadoNegocio,
  type Milesimas,
  type Negocio,
  type Producto,
} from '../../core/negocio';

/**
 * El pedido que se arma en Vender (el carrito). Sólo dice QUÉ y CUÁNTO: los precios, el descuento
 * y el total que se guardan los pone el núcleo en `Negocio.vender`. Aquí se calcula una vista
 * previa con las mismas funciones (`importe`, `aplicarDescuento`) para mostrarla mientras se arma.
 */
export interface LineaPedido {
  readonly productoId: string;
  readonly cantidad: Milesimas;
}

export type TipoDescuento = 'ninguno' | 'porcentaje' | 'valor';

export interface Pedido {
  readonly lineas: readonly LineaPedido[];
  readonly tipoDescuento: TipoDescuento;
  /** Texto del descuento tal como lo escribe la persona */
  readonly textoDescuento: string;
}

export const PEDIDO_VACIO: Pedido = { lineas: [], tipoDescuento: 'ninguno', textoDescuento: '' };

const MIL = 1000;

/** Suma `cantidad` (milésimas) a la línea del producto, o la crea. */
export function sumar(p: Pedido, productoId: string, cantidad = MIL): Pedido {
  const existe = p.lineas.some((l) => l.productoId === productoId);
  const lineas = existe
    ? p.lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad: milesimas(l.cantidad + cantidad) } : l))
    : [...p.lineas, { productoId, cantidad: milesimas(cantidad) }];
  return { ...p, lineas: lineas.filter((l) => l.cantidad > 0) };
}

/** Fija la cantidad de una línea; 0 o menos la quita. */
export function fijar(p: Pedido, productoId: string, cantidad: Milesimas): Pedido {
  if (cantidad <= 0) return quitar(p, productoId);
  return { ...p, lineas: p.lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l)) };
}

export function quitar(p: Pedido, productoId: string): Pedido {
  return { ...p, lineas: p.lineas.filter((l) => l.productoId !== productoId) };
}

/** Unidades del producto en el pedido (para el número sobre el +). */
export function enPedido(p: Pedido, productoId: string): number {
  const l = p.lineas.find((x) => x.productoId === productoId);
  return l ? Math.round(l.cantidad / MIL) : 0;
}

/** Descuento escrito → el del núcleo. Lanza `NumeroInvalido` (en español) si está mal escrito. */
export function descuentoDe(p: Pedido): Descuento | null {
  const t = p.textoDescuento.trim();
  if (p.tipoDescuento === 'ninguno' || t === '') return null;
  if (p.tipoDescuento === 'porcentaje') {
    const valor = Number(t.replace('%', '').trim());
    if (!/^\d{1,3}\s*%?$/.test(t) || !Number.isInteger(valor) || valor > 100) {
      throw new RangeError('Descuento: el porcentaje es un número entero de 0 a 100.');
    }
    return { tipo: 'porcentaje', valor };
  }
  return { tipo: 'valor', valor: leerDinero(t) };
}

export interface VistaPrevia {
  readonly lineas: ReadonlyArray<{ linea: LineaPedido; producto: Producto; subtotal: Centavos }>;
  readonly bruto: Centavos;
  readonly descuento: Centavos;
  readonly total: Centavos;
  /** Unidades (aprox.) para el contador del botón */
  readonly articulos: number;
  /** Mensaje si el descuento está mal escrito o pasa del total */
  readonly errorDescuento: string | null;
}

/** Vista previa del pedido con los precios vigentes. Los productos que ya no están, se omiten. */
export function vistaPrevia(p: Pedido, estado: EstadoNegocio): VistaPrevia {
  const lineas = p.lineas.flatMap((linea) => {
    const producto = estado.productos[linea.productoId];
    return producto?.activo ? [{ linea, producto, subtotal: importe(linea.cantidad, producto.precio) }] : [];
  });
  const bruto = centavos(lineas.reduce((s, l) => s + l.subtotal, 0));
  let descuento = centavos(0);
  let errorDescuento: string | null = null;
  try {
    const d = descuentoDe(p);
    if (d) descuento = aplicarDescuento(bruto, d).monto;
  } catch (e) {
    errorDescuento = e instanceof Error ? e.message : 'Descuento inválido.';
  }
  const articulos = lineas.reduce((s, l) => s + (l.producto.unidad === 'unidad' ? Math.round(l.linea.cantidad / MIL) : 1), 0);
  return { lineas, bruto, descuento, total: centavos(bruto - descuento), articulos, errorDescuento };
}

export type Existencias = 'ok' | 'bajo' | 'agotado';

export function existencias(estado: EstadoNegocio, p: Producto): Existencias {
  const stock = stockDe(estado, p.id);
  if (stock <= 0) return 'agotado';
  if (p.stockMinimo !== null && stock <= p.stockMinimo) return 'bajo';
  return 'ok';
}

/**
 * El pedido sobrevive a cambiar de pantalla (ir a Caja y volver) mientras la app esté abierta.
 * Se guarda por negocio: otro negocio (las pruebas) empieza vacío.
 */
const guardados = new WeakMap<Negocio, Pedido>();

export function pedidoGuardado(n: Negocio): Pedido {
  return guardados.get(n) ?? PEDIDO_VACIO;
}

export function guardarPedido(n: Negocio, p: Pedido): void {
  guardados.set(n, p);
}
