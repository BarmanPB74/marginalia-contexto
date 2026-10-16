/**
 * Contabilidad de Stark: sólo lectura, junta lo que ya está en el diario.
 *
 * `resumen(eventos, estado, periodo)` responde: cuánto se vendió (bruto, descuentos, neto,
 * por forma de pago y por producto), cuánto costó lo vendido, cuánto se gastó, cuánto se
 * pagó a proveedores, qué se debe y cómo cuadraron las cajas.
 *
 * Decisiones (dilas en pantalla):
 * - **Costo aproximado**: las ventas no guardan su costo histórico; el costo de ventas usa
 *   el costo VIGENTE de cada producto (el de la última factura aplicada). Por eso
 *   `costoAproximado: true` y `productosSinCosto` (lo que no entra en la cuenta).
 * - **Cortesías**: cuentan como venta (salió mercancía) pero no entró plata: `ingresoReal`
 *   = ventas netas − cortesías, y el margen se calcula sobre el ingreso real.
 * - **Ingreso por producto** es el bruto de sus líneas (antes del descuento de la venta,
 *   que es de toda la cuenta y no se reparte).
 * - Las ventas anuladas no cuentan (se buscan anulaciones en TODOS los eventos recibidos,
 *   aunque caigan después del período). El período usa la fecha local de cada evento.
 * - No es contabilidad fiscal ni factura DIAN: es el cuaderno del negocio.
 */
import { centavos, importe, milesimas, pesosPlano, mostrarCantidad, type Centavos, type Milesimas } from './numeros';
import { FORMAS_EGRESO, FORMAS_PAGO, NOMBRE_FORMA, type FormaEgreso, type FormaPago } from './modelo';
import { diaDe, type Evento } from './eventos';
import type { EstadoNegocio } from './estado';

/** Días locales 'AAAA-MM-DD', inclusive. */
export interface Periodo {
  readonly desde: string;
  readonly hasta: string;
}

export interface VentaPorProducto {
  readonly productoId: string;
  readonly nombre: string;
  readonly cantidad: Milesimas;
  readonly ingreso: Centavos;
}

export interface CuentaPorPagar {
  readonly compraId: string;
  readonly proveedor: string;
  readonly numero: string;
  readonly fecha: string;
  readonly vence: string | null;
  readonly total: Centavos;
  readonly pagado: Centavos;
  readonly saldo: Centavos;
}

export interface Cuadre {
  readonly cajaId: string;
  readonly cerradaEn: string;
  readonly cerradaPor: string;
  readonly esperado: Centavos;
  readonly contado: Centavos;
  readonly diferencia: Centavos;
  readonly nota: string | null;
}

export interface Resumen {
  readonly periodo: Periodo;
  readonly ventas: {
    readonly cantidad: number;
    readonly anuladas: number;
    readonly bruto: Centavos;
    readonly descuentos: Centavos;
    readonly netas: Centavos;
    readonly porForma: Readonly<Record<FormaPago, Centavos>>;
    /** Netas sin cortesías: la plata que de verdad entró por ventas. */
    readonly ingresoReal: Centavos;
  };
  readonly porProducto: readonly VentaPorProducto[];
  readonly costoVentas: Centavos;
  /** Siempre `true`: se usa el costo vigente, no el de cada venta. */
  readonly costoAproximado: true;
  /** Productos vendidos sin costo conocido (no suman al costo de ventas). */
  readonly productosSinCosto: readonly string[];
  /** ingresoReal − costoVentas. */
  readonly margenBruto: Centavos;
  readonly gastos: { readonly total: Centavos; readonly porCategoria: Readonly<Record<string, Centavos>> };
  readonly pagosProveedores: { readonly total: Centavos; readonly porForma: Readonly<Record<FormaEgreso, Centavos>> };
  /** Facturas de compra registradas en el período (sin anuladas). */
  readonly compras: { readonly cantidad: number; readonly total: Centavos };
  /** Lo que se debe HOY (no depende del período), ordenado por vencimiento. */
  readonly cuentasPorPagar: readonly CuentaPorPagar[];
  readonly totalPorPagar: Centavos;
  readonly cuadres: readonly Cuadre[];
  /** Suma de las diferencias de caja del período (negativo = faltó plata). */
  readonly diferenciaCajas: Centavos;
  /** margenBruto − gastos. Aproximado, por el costo vigente. */
  readonly resultadoAproximado: Centavos;
}

function enPeriodo(e: Evento, p: Periodo): boolean {
  const d = diaDe(e);
  return d >= p.desde && d <= p.hasta;
}

function ceros<K extends string>(claves: readonly K[]): Record<K, number> {
  return Object.fromEntries(claves.map((k) => [k, 0])) as Record<K, number>;
}

/** Resumen contable del período. `eventos` puede traer más de lo necesario: se filtra. */
export function resumen(eventos: readonly Evento[], estado: EstadoNegocio, periodo: Periodo): Resumen {
  const ventasAnuladas = new Set<string>();
  const gastosAnulados = new Set<string>();
  const comprasAnuladas = new Set<string>();
  for (const e of eventos) {
    if (e.tipo === 'venta.anulada') ventasAnuladas.add(e.datos.ventaId);
    else if (e.tipo === 'gasto.anulado') gastosAnulados.add(e.datos.gastoId);
    else if (e.tipo === 'compra.anulada') comprasAnuladas.add(e.datos.compraId);
  }

  let cantidad = 0;
  let anuladas = 0;
  let bruto = 0;
  let descuentos = 0;
  let netas = 0;
  let costoVentas = 0;
  const porForma = ceros(FORMAS_PAGO);
  const productos = new Map<string, { nombre: string; cantidad: number; ingreso: number }>();
  const sinCosto = new Set<string>();
  let gastosTotal = 0;
  const gastosPorCategoria: Record<string, number> = {};
  let pagosTotal = 0;
  const pagosPorForma = ceros(FORMAS_EGRESO);
  let comprasCantidad = 0;
  let comprasTotal = 0;
  const cuadres: Cuadre[] = [];

  for (const e of eventos) {
    if (!enPeriodo(e, periodo)) continue;
    switch (e.tipo) {
      case 'venta.registrada': {
        if (ventasAnuladas.has(e.id)) {
          anuladas++;
          break;
        }
        cantidad++;
        netas += e.datos.total;
        descuentos += e.datos.descuento?.monto ?? 0;
        for (const p of e.datos.pagos) porForma[p.forma] += p.monto;
        for (const l of e.datos.lineas) {
          bruto += l.subtotal;
          const fila = productos.get(l.productoId) ?? { nombre: l.nombre, cantidad: 0, ingreso: 0 };
          fila.nombre = estado.productos[l.productoId]?.nombre ?? l.nombre;
          fila.cantidad += l.cantidad;
          fila.ingreso += l.subtotal;
          productos.set(l.productoId, fila);
          const costo = estado.productos[l.productoId]?.costo ?? null;
          if (costo === null) sinCosto.add(fila.nombre);
          else costoVentas += importe(l.cantidad, costo);
        }
        break;
      }
      case 'gasto.registrado':
        if (gastosAnulados.has(e.id)) break;
        gastosTotal += e.datos.monto;
        gastosPorCategoria[e.datos.categoria] = (gastosPorCategoria[e.datos.categoria] ?? 0) + e.datos.monto;
        break;
      case 'pago.factura':
        pagosTotal += e.datos.monto;
        pagosPorForma[e.datos.forma] += e.datos.monto;
        break;
      case 'compra.registrada':
        if (comprasAnuladas.has(e.id)) break;
        comprasCantidad++;
        comprasTotal += e.datos.total;
        break;
      case 'caja.cerrada':
        cuadres.push({
          cajaId: e.datos.cajaId,
          cerradaEn: e.en,
          cerradaPor: e.por,
          esperado: e.datos.esperado,
          contado: e.datos.contado,
          diferencia: e.datos.diferencia,
          nota: e.datos.nota ?? null,
        });
        break;
      default:
        break;
    }
  }

  const cuentasPorPagar: CuentaPorPagar[] = Object.values(estado.compras)
    .filter((c) => c.estado !== 'anulada' && c.saldo > 0)
    .map((c) => ({
      compraId: c.id,
      proveedor: c.proveedor,
      numero: c.numero,
      fecha: c.fecha,
      vence: c.vence,
      total: c.total,
      pagado: c.pagado,
      saldo: c.saldo,
    }))
    .sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999') || a.fecha.localeCompare(b.fecha));

  const ingresoReal = netas - porForma.cortesia;
  const margenBruto = ingresoReal - costoVentas;
  return {
    periodo,
    ventas: {
      cantidad,
      anuladas,
      bruto: centavos(bruto),
      descuentos: centavos(descuentos),
      netas: centavos(netas),
      porForma: porForma as Record<FormaPago, Centavos>,
      ingresoReal: centavos(ingresoReal),
    },
    porProducto: [...productos]
      .map(([productoId, f]) => ({ productoId, nombre: f.nombre, cantidad: milesimas(f.cantidad), ingreso: centavos(f.ingreso) }))
      .sort((a, b) => b.ingreso - a.ingreso || a.nombre.localeCompare(b.nombre, 'es')),
    costoVentas: centavos(costoVentas),
    costoAproximado: true,
    productosSinCosto: [...sinCosto].sort((a, b) => a.localeCompare(b, 'es')),
    margenBruto: centavos(margenBruto),
    gastos: { total: centavos(gastosTotal), porCategoria: gastosPorCategoria as Record<string, Centavos> },
    pagosProveedores: { total: centavos(pagosTotal), porForma: pagosPorForma as Record<FormaEgreso, Centavos> },
    compras: { cantidad: comprasCantidad, total: centavos(comprasTotal) },
    cuentasPorPagar,
    totalPorPagar: centavos(cuentasPorPagar.reduce((s, c) => s + c.saldo, 0)),
    cuadres,
    diferenciaCajas: centavos(cuadres.reduce((s, c) => s + c.diferencia, 0)),
    resultadoAproximado: centavos(margenBruto - gastosTotal),
  };
}

// --- Rastro de inventario ---------------------------------------------------------

export interface MovimientoStock {
  readonly en: string;
  readonly por: string;
  readonly eventoId: string;
  readonly tipo: 'venta' | 'anulacion' | 'compra' | 'ajuste';
  readonly delta: Milesimas;
  /** Motivo del ajuste, número de factura o id de venta. */
  readonly detalle: string;
}

/**
 * Todo cambio de stock de un producto, en orden (el «kárdex»). Sale de los eventos: no hay
 * forma de cambiar el stock sin dejar uno. Para las compras aplicadas busca sus líneas en
 * los mismos eventos o, si la factura es anterior, en `estado.compras`.
 */
export function movimientosStock(eventos: readonly Evento[], productoId: string, estado?: EstadoNegocio): MovimientoStock[] {
  const ventas = new Map<string, Milesimas>();
  const compras = new Map<string, { numero: string; cantidad: Milesimas }>();
  const r: MovimientoStock[] = [];
  const base = (e: Evento) => ({ en: e.en, por: e.por, eventoId: e.id });
  for (const e of eventos) {
    switch (e.tipo) {
      case 'venta.registrada': {
        const l = e.datos.lineas.find((x) => x.productoId === productoId);
        if (!l) break;
        ventas.set(e.id, l.cantidad);
        r.push({ ...base(e), tipo: 'venta', delta: milesimas(-l.cantidad), detalle: `venta ${e.id}` });
        break;
      }
      case 'venta.anulada': {
        const q = ventas.get(e.datos.ventaId) ?? estado?.ventas[e.datos.ventaId]?.lineas.find((x) => x.productoId === productoId)?.cantidad;
        if (q !== undefined) r.push({ ...base(e), tipo: 'anulacion', delta: q, detalle: `anulación: ${e.datos.motivo}` });
        break;
      }
      case 'compra.registrada': {
        const l = e.datos.lineas.find((x) => x.productoId === productoId);
        if (l) compras.set(e.id, { numero: e.datos.numero, cantidad: l.cantidad });
        break;
      }
      case 'compra.aplicada': {
        let c = compras.get(e.datos.compraId);
        if (!c && estado) {
          const k = estado.compras[e.datos.compraId];
          const l = k?.lineas.find((x) => x.productoId === productoId);
          if (k && l) c = { numero: k.numero, cantidad: l.cantidad };
        }
        if (c) r.push({ ...base(e), tipo: 'compra', delta: c.cantidad, detalle: `factura ${c.numero}` });
        break;
      }
      case 'inventario.ajuste':
        if (e.datos.productoId === productoId) {
          r.push({ ...base(e), tipo: 'ajuste', delta: e.datos.delta, detalle: e.datos.nota ? `${e.datos.motivo}: ${e.datos.nota}` : e.datos.motivo });
        }
        break;
      default:
        break;
    }
  }
  return r;
}

// --- CSV ---------------------------------------------------------------------------

export type Celda = string | number | null | undefined;

const NUMERO_PLANO = /^-?\d+(?:,\d+)?$/;
// Lo que una hoja de cálculo interpretaría como fórmula (OWASP «CSV injection»).
const INICIO_FORMULA = /^[=+\-@\t\r]/;

function celdaCsv(c: Celda): string {
  if (c === null || c === undefined) return '';
  let t = typeof c === 'number' ? (Number.isFinite(c) ? String(c) : '') : String(c);
  if (typeof c === 'string' && INICIO_FORMULA.test(t) && !NUMERO_PLANO.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) || t !== t.trim() ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * Filas → CSV separado por `;` (lo que espera Excel en español), con saltos `\r\n`.
 * Protección contra inyección de fórmulas: un texto que empieza por = + - @ (o tabulador)
 * se prefija con «'». Los números negativos ('-8500,50') no son fórmulas y se respetan.
 * `bom`: antepone la marca UTF-8 para que Excel muestre bien las tildes.
 */
export function aCsv(filas: readonly (readonly Celda[])[], opciones: { readonly bom?: boolean } = {}): string {
  const cuerpo = filas.map((f) => f.map(celdaCsv).join(';')).join('\r\n');
  return (opciones.bom ? '﻿' : '') + cuerpo + '\r\n';
}

/** El resumen como tabla larga: sección; concepto; cantidad; valor (pesos con coma decimal). */
export function resumenACsv(r: Resumen, opciones: { readonly bom?: boolean } = {}): string {
  const filas: Celda[][] = [['Sección', 'Concepto', 'Cantidad', 'Valor (COP)']];
  const fila = (s: string, c: string, cant: Celda, v: Centavos | null) => filas.push([s, c, cant, v === null ? null : pesosPlano(v)]);
  fila('Período', `${r.periodo.desde} a ${r.periodo.hasta}`, null, null);
  fila('Ventas', 'Ventas registradas', r.ventas.cantidad, null);
  fila('Ventas', 'Ventas anuladas', r.ventas.anuladas, null);
  fila('Ventas', 'Bruto', null, r.ventas.bruto);
  fila('Ventas', 'Descuentos', null, r.ventas.descuentos);
  fila('Ventas', 'Netas', null, r.ventas.netas);
  for (const f of FORMAS_PAGO) fila('Ventas por forma de pago', NOMBRE_FORMA[f], null, r.ventas.porForma[f]);
  fila('Ventas', 'Ingreso real (sin cortesías)', null, r.ventas.ingresoReal);
  for (const p of r.porProducto) fila('Ventas por producto', p.nombre, mostrarCantidad(p.cantidad), p.ingreso);
  fila('Margen', 'Costo de ventas (aproximado, costo vigente)', null, r.costoVentas);
  fila('Margen', 'Margen bruto', null, r.margenBruto);
  for (const n of r.productosSinCosto) fila('Margen', `Sin costo: ${n}`, null, null);
  for (const [c, v] of Object.entries(r.gastos.porCategoria)) fila('Gastos', c, null, v);
  fila('Gastos', 'Total gastos', null, r.gastos.total);
  for (const f of FORMAS_EGRESO) fila('Pagos a proveedores', NOMBRE_FORMA[f], null, r.pagosProveedores.porForma[f]);
  fila('Pagos a proveedores', 'Total pagado', null, r.pagosProveedores.total);
  fila('Compras', 'Facturas registradas', r.compras.cantidad, r.compras.total);
  for (const c of r.cuentasPorPagar) {
    fila('Cuentas por pagar', `${c.proveedor} ${c.numero}${c.vence ? ` (vence ${c.vence})` : ''}`, null, c.saldo);
  }
  fila('Cuentas por pagar', 'Total por pagar', null, r.totalPorPagar);
  for (const c of r.cuadres) fila('Cuadres de caja', `${c.cerradaEn}${c.nota ? ` — ${c.nota}` : ''}`, null, c.diferencia);
  fila('Cuadres de caja', 'Diferencia total', null, r.diferenciaCajas);
  fila('Resultado', 'Resultado aproximado (margen − gastos)', null, r.resultadoAproximado);
  return aCsv(filas, opciones);
}

/** Detalle de ventas del período, una fila por línea vendida (sin anuladas). */
export function ventasACsv(eventos: readonly Evento[], periodo: Periodo, opciones: { readonly bom?: boolean } = {}): string {
  const anuladas = new Set(eventos.flatMap((e) => (e.tipo === 'venta.anulada' ? [e.datos.ventaId] : [])));
  const filas: Celda[][] = [['Fecha', 'Venta', 'Producto', 'Cantidad', 'Precio unitario', 'Subtotal', 'Formas de pago']];
  for (const e of eventos) {
    if (e.tipo !== 'venta.registrada' || !enPeriodo(e, periodo) || anuladas.has(e.id)) continue;
    const formas = e.datos.pagos.map((p) => `${NOMBRE_FORMA[p.forma]} ${pesosPlano(p.monto)}`).join(' + ');
    for (const l of e.datos.lineas) {
      filas.push([e.en, e.id, l.nombre, mostrarCantidad(l.cantidad), pesosPlano(l.precioUnit), pesosPlano(l.subtotal), formas]);
    }
  }
  return aCsv(filas, opciones);
}
