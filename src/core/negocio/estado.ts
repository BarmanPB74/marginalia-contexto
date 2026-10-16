/**
 * Estado del negocio = proyección de los eventos del diario.
 *
 * - `validar(estado, evento)` decide si el evento puede ocurrir AHORA. Si no, lanza
 *   `ReglaRota` con un mensaje claro para la persona. Es la única puerta de las reglas.
 * - `aplicar(estado, evento)` calcula el estado siguiente. Es puro e inmutable: nunca
 *   modifica el estado recibido (copia sólo lo que cambia).
 *
 * Al cargar el diario se usa sólo `aplicar` (los eventos ya se validaron cuando se
 * escribieron y la cadena de hashes garantiza que no cambiaron). Así una regla nueva en
 * una versión futura no deja «ilegible» la historia.
 *
 * Decisiones:
 * - El stock PUEDE quedar negativo (los inventarios reales lo tienen: se vendió antes de
 *   registrar la factura). `alertas()` lo señala.
 * - `ventas` guarda sólo las ventas de la caja abierta: es lo único anulable (anular una
 *   venta de una caja cerrada cambiaría un cuadre ya firmado). La historia completa de
 *   ventas se lee del diario (`contabilidad.ts`), no del estado: así el estado y la
 *   instantánea no crecen sin fin.
 * - Mesas (como Bar_box): una mesa tiene como máximo UNA cuenta abierta; las rondas no tocan
 *   el inventario: lo descuenta la venta que cobra la cuenta (con los precios vigentes al
 *   cobrar). `cuentas` guarda sólo las abiertas; la historia está en el diario. La caja no
 *   se cierra con cuentas abiertas: lo servido se cobra (o se anula) en su turno.
 * - Cuadre: esperado = base + ventas en efectivo + ingresos − retiros − gastos y pagos
 *   pagados de caja. Sólo el efectivo; lo demás no está en el cajón.
 */
import {
  aplicarDescuento,
  centavos,
  importe,
  milesimas,
  pesos,
  mostrarCantidad,
  MAX_CENTAVOS,
  type Centavos,
  type Milesimas,
} from './numeros';
import { FORMAS_PAGO, LIMITES, type FormaEgreso, type FormaPago, type Mesa, type Producto, type Usuario } from './modelo';
import {
  ReglaRota,
  type DatosProducto,
  type DescuentoAplicado,
  type Evento,
  type EventoDe,
  type LineaCompra,
  type LineaCuenta,
  type LineaVenta,
  type PagoVenta,
} from './eventos';

export const HASH_INICIAL = '0'.repeat(64);
/** 2: mesas y cuentas. Una instantánea de otra versión se ignora y se repite el diario. */
export const VERSION_ESTADO = 2;

export type PorForma = Readonly<Record<FormaPago, Centavos>>;

/** Totales de una caja. `actividad` cuenta ventas, anulaciones y movimientos de plata. */
export interface CifrasCaja {
  readonly id: string;
  readonly base: Centavos;
  readonly abiertaEn: string;
  readonly abiertaPor: string;
  /** Ventas vigentes (sin anuladas) por forma de pago. */
  readonly ventasPorForma: PorForma;
  readonly ventas: number;
  readonly anuladas: number;
  readonly ingresos: Centavos;
  readonly retiros: Centavos;
  /** Gastos pagados con plata del cajón. */
  readonly gastos: Centavos;
  /** Pagos a proveedores con plata del cajón. */
  readonly pagos: Centavos;
  readonly actividad: number;
}

export type CajaAbierta = CifrasCaja;

export interface CajaCerrada extends CifrasCaja {
  readonly cerradaEn: string;
  readonly cerradaPor: string;
  readonly esperado: Centavos;
  readonly contado: Centavos;
  readonly diferencia: Centavos;
  readonly nota: string | null;
}

export interface Venta {
  readonly id: string;
  readonly cajaId: string;
  readonly en: string;
  readonly por: string;
  readonly lineas: readonly LineaVenta[];
  readonly descuento: DescuentoAplicado | null;
  readonly total: Centavos;
  readonly pagos: readonly PagoVenta[];
  readonly recibido: Centavos | null;
  readonly cambio: Centavos | null;
  readonly anulada: boolean;
  readonly motivoAnulacion: string | null;
}

export type EstadoCompra = 'registrada' | 'aplicada' | 'anulada';

export interface Compra {
  readonly id: string;
  readonly proveedor: string;
  readonly numero: string;
  readonly fecha: string;
  readonly vence: string | null;
  readonly lineas: readonly LineaCompra[];
  readonly total: Centavos;
  readonly adjuntos: readonly string[];
  readonly nota: string | null;
  readonly registradaEn: string;
  readonly por: string;
  readonly estado: EstadoCompra;
  readonly aplicadaEn: string | null;
  readonly pagado: Centavos;
  /** total − pagado (0 si está anulada). */
  readonly saldo: Centavos;
}

export interface Gasto {
  readonly id: string;
  readonly categoria: string;
  readonly descripcion: string;
  readonly monto: Centavos;
  readonly forma: FormaEgreso;
  readonly deCaja: boolean;
  /** Caja de la que salió la plata (si `deCaja`). */
  readonly cajaId: string | null;
  readonly adjunto: string | null;
  readonly en: string;
  readonly por: string;
  readonly anulado: boolean;
}

/** Cuenta abierta de una mesa. */
export interface Cuenta {
  readonly id: string;
  readonly mesaId: string;
  readonly abiertaEn: string;
  readonly abiertaPor: string;
  readonly personas: number | null;
  /** Lo pedido menos lo quitado, sumado por producto, en el orden en que se pidió. */
  readonly lineas: readonly LineaCuenta[];
  readonly rondas: number;
  /** Hora del último pedido (para ver qué mesa lleva rato esperando). */
  readonly ultimoPedidoEn: string | null;
  /** La mesa pidió la cuenta. */
  readonly precuenta: boolean;
}

export interface EstadoNegocio {
  readonly version: number;
  readonly usuarios: Readonly<Record<string, Usuario>>;
  readonly productos: Readonly<Record<string, Producto>>;
  /** Existencia por producto, en milésimas. Puede ser negativa. */
  readonly stock: Readonly<Record<string, Milesimas>>;
  readonly caja: CajaAbierta | null;
  readonly cierres: readonly CajaCerrada[];
  /** Ventas de la caja abierta (las únicas anulables). */
  readonly ventas: Readonly<Record<string, Venta>>;
  readonly compras: Readonly<Record<string, Compra>>;
  readonly gastos: Readonly<Record<string, Gasto>>;
  readonly mesas: Readonly<Record<string, Mesa>>;
  /** Cuentas abiertas (las cobradas o anuladas salen de aquí; quedan en el diario). */
  readonly cuentas: Readonly<Record<string, Cuenta>>;
  /** Cuántos eventos se han aplicado. */
  readonly eventos: number;
  readonly ultimoId: string | null;
  readonly ultimoHash: string;
}

export function estadoVacio(): EstadoNegocio {
  return {
    version: VERSION_ESTADO,
    usuarios: {},
    productos: {},
    stock: {},
    caja: null,
    cierres: [],
    ventas: {},
    compras: {},
    gastos: {},
    mesas: {},
    cuentas: {},
    eventos: 0,
    ultimoId: null,
    ultimoHash: HASH_INICIAL,
  };
}

const CERO = centavos(0);

function porFormaVacio(): Record<FormaPago, Centavos> {
  return Object.fromEntries(FORMAS_PAGO.map((f) => [f, CERO])) as Record<FormaPago, Centavos>;
}

/** Efectivo que debería haber en el cajón. */
export function esperadoCaja(c: CifrasCaja): Centavos {
  return centavos(c.base + c.ventasPorForma.efectivo + c.ingresos - c.retiros - c.gastos - c.pagos);
}

/** Total vendido (todas las formas, sin anuladas). */
export function vendidoCaja(c: CifrasCaja): Centavos {
  return centavos(FORMAS_PAGO.reduce((s, f) => s + c.ventasPorForma[f], 0));
}

export function hayUsuarios(estado: EstadoNegocio): boolean {
  return Object.keys(estado.usuarios).length > 0;
}

/** Cuenta abierta de la mesa, si la tiene. */
export function cuentaDeMesa(estado: EstadoNegocio, mesaId: string): Cuenta | null {
  return Object.values(estado.cuentas).find((c) => c.mesaId === mesaId) ?? null;
}

/** Cantidad pedida de un producto en una cuenta. */
export function pedidoEnCuenta(c: Cuenta, productoId: string): Milesimas {
  return c.lineas.find((l) => l.productoId === productoId)?.cantidad ?? milesimas(0);
}

export function stockDe(estado: EstadoNegocio, productoId: string): Milesimas {
  return estado.stock[productoId] ?? milesimas(0);
}

const norma = (t: string) => t.normalize('NFC').toLocaleLowerCase('es');

// --- Validación ---------------------------------------------------------------

function falla(mensaje: string): never {
  throw new ReglaRota(mensaje);
}

function producto(estado: EstadoNegocio, id: string, activo = true): Producto {
  const p = estado.productos[id] ?? falla('Ese producto no existe.');
  if (activo && !p.activo) falla(`«${p.nombre}» está archivado.`);
  return p;
}

function cajaAbierta(estado: EstadoNegocio, accion: string): CajaAbierta {
  return estado.caja ?? falla(`No hay caja abierta. Abre la caja antes de ${accion}.`);
}

/** Plata que sale del cajón: sólo en efectivo y sin pasar de lo que debería haber. */
function salidaDeCaja(estado: EstadoNegocio, forma: FormaEgreso, monto: Centavos, que: string) {
  const caja = cajaAbierta(estado, `pagar ${que} con plata de la caja`);
  if (forma !== 'efectivo') falla('Lo que sale del cajón es efectivo. Para tarjeta o transferencia, desmarca «de la caja».');
  const hay = esperadoCaja(caja);
  if (monto > hay) {
    falla(`No puedes sacar ${pesos(monto)} de la caja: según el cuadre sólo hay ${pesos(hay)}. Revisa la cifra o registra primero el ingreso que falta.`);
  }
}

function unicoNombreProducto(estado: EstadoNegocio, datos: Partial<DatosProducto>, excepto?: string) {
  for (const p of Object.values(estado.productos)) {
    if (!p.activo || p.id === excepto) continue;
    if (datos.nombre !== undefined && norma(p.nombre) === norma(datos.nombre)) {
      falla(`Ya existe un producto llamado «${p.nombre}».`);
    }
    if (datos.codigo != null && p.codigo !== undefined && norma(p.codigo) === norma(datos.codigo)) {
      falla(`El código «${datos.codigo}» ya es de «${p.nombre}».`);
    }
  }
}

function sinRepetidos(ids: readonly string[], que: string) {
  if (new Set(ids).size !== ids.length) falla(`Hay un producto repetido en ${que}: súmalo en una sola línea.`);
}

function mesa(estado: EstadoNegocio, id: string): Mesa {
  const m = estado.mesas[id] ?? falla('Esa mesa no existe.');
  if (!m.activa) falla(`«${m.nombre}» ya no está en el mapa.`);
  return m;
}

function cuenta(estado: EstadoNegocio, id: string): Cuenta {
  return estado.cuentas[id] ?? falla('Esa cuenta ya se cerró (cobrada o anulada).');
}

function mesaLibre(estado: EstadoNegocio, mesaId: string) {
  const m = mesa(estado, mesaId);
  if (cuentaDeMesa(estado, mesaId)) falla(`«${m.nombre}» ya tiene una cuenta abierta.`);
}

function validarVenta(estado: EstadoNegocio, e: EventoDe<'venta.registrada'>) {
  const d = e.datos;
  const caja = cajaAbierta(estado, 'vender');
  if (d.cajaId !== caja.id) falla('La venta no es de la caja abierta. Vuelve a armarla.');
  sinRepetidos(d.lineas.map((l) => l.productoId), 'la venta');
  if (d.cuentaId !== undefined) {
    const cuenta = estado.cuentas[d.cuentaId] ?? falla('Esa cuenta ya se cobró o no existe.');
    const iguales =
      cuenta.lineas.length === d.lineas.length &&
      d.lineas.every((l) => pedidoEnCuenta(cuenta, l.productoId) === l.cantidad);
    if (!iguales) falla('La cuenta de la mesa cambió mientras cobrabas. Vuelve a abrir el cobro.');
  }
  let bruto = 0;
  for (const l of d.lineas) {
    const p = producto(estado, l.productoId);
    if (l.precioUnit !== p.precio || l.nombre !== p.nombre) {
      falla(`«${p.nombre}» cambió (precio o nombre) mientras armabas la venta. Vuelve a armarla.`);
    }
    if (p.unidad === 'unidad' && l.cantidad % 1000 !== 0) {
      falla(`«${p.nombre}» se vende por unidades enteras, no ${mostrarCantidad(l.cantidad)}.`);
    }
    if (l.subtotal !== importe(l.cantidad, l.precioUnit)) falla('El subtotal de una línea no cuadra.');
    bruto += l.subtotal;
  }
  let descuento = 0;
  if (d.descuento) {
    const calculado = aplicarDescuento(
      centavos(bruto),
      d.descuento.tipo === 'porcentaje'
        ? { tipo: 'porcentaje', valor: d.descuento.valor }
        : { tipo: 'valor', valor: centavos(d.descuento.valor) },
    );
    if (calculado.monto !== d.descuento.monto) falla('El descuento no cuadra.');
    descuento = calculado.monto;
  }
  if (d.total !== bruto - descuento) falla('El total de la venta no cuadra con sus líneas.');
  if (d.total > MAX_CENTAVOS) falla('La venta supera el máximo permitido.');
  if (new Set(d.pagos.map((p) => p.forma)).size !== d.pagos.length) falla('Cada forma de pago va una sola vez.');
  const pagado = d.pagos.reduce((s, p) => s + p.monto, 0);
  if (d.total === 0 ? d.pagos.length > 0 : pagado !== d.total) {
    falla(`Los pagos (${pesos(centavos(pagado))}) no suman el total (${pesos(d.total)}).`);
  }
  const efectivo = d.pagos.find((p) => p.forma === 'efectivo')?.monto ?? 0;
  if (d.recibido !== undefined) {
    if (efectivo === 0) falla('«Recibido» sólo aplica a pagos en efectivo.');
    if (d.recibido < efectivo) falla(`Recibiste ${pesos(d.recibido)}, menos que el efectivo a pagar (${pesos(centavos(efectivo))}).`);
    if (d.cambio !== d.recibido - efectivo) falla('El cambio no cuadra.');
  } else if (d.cambio !== undefined) {
    falla('Hay cambio sin «recibido».');
  }
}

/**
 * ¿Puede ocurrir este evento sobre este estado? Lanza `ReglaRota` si no.
 * No mira permisos (eso es `permisos.ts`): sólo reglas del negocio.
 */
export function validar(estado: EstadoNegocio, evento: Evento): void {
  const primerUso = !hayUsuarios(estado);
  if (evento.tipo === 'usuario.creado' && primerUso) {
    if (evento.datos.rol !== 'dueno') falla('El primer usuario es el dueño.');
    if (evento.por !== evento.id) falla('El primer usuario se crea a sí mismo.');
  } else {
    const autor = estado.usuarios[evento.por];
    if (!autor) falla('Usuario desconocido. Inicia sesión otra vez.');
    if (!autor.activo) falla('Tu usuario está desactivado.');
  }
  const creaAlgo = new Set([
    'usuario.creado', 'producto.creado', 'caja.abierta', 'venta.registrada', 'compra.registrada', 'gasto.registrado',
    'mesa.creada', 'cuenta.abierta',
  ]);
  if (creaAlgo.has(evento.tipo)) {
    const usado =
      evento.id in estado.usuarios || evento.id in estado.productos || evento.id in estado.ventas ||
      evento.id in estado.compras || evento.id in estado.gastos || evento.id in estado.mesas ||
      evento.id in estado.cuentas || estado.caja?.id === evento.id;
    if (usado) falla('Ese registro ya existe (identificador repetido).');
  }

  switch (evento.tipo) {
    case 'usuario.creado': {
      const nombre = norma(evento.datos.nombre);
      if (Object.values(estado.usuarios).some((u) => u.activo && norma(u.nombre) === nombre)) {
        falla(`Ya hay un usuario activo llamado «${evento.datos.nombre}».`);
      }
      return;
    }
    case 'usuario.pin': {
      const u = estado.usuarios[evento.datos.usuarioId] ?? falla('Ese usuario no existe.');
      if (!u.activo) falla(`«${u.nombre}» está desactivado.`);
      return;
    }
    case 'usuario.desactivado': {
      const u = estado.usuarios[evento.datos.usuarioId] ?? falla('Ese usuario no existe.');
      if (!u.activo) falla(`«${u.nombre}» ya está desactivado.`);
      const duenos = Object.values(estado.usuarios).filter((x) => x.activo && x.rol === 'dueno');
      if (u.rol === 'dueno' && duenos.length <= 1) falla('No puedes desactivar al único dueño activo: el negocio quedaría sin dueño.');
      return;
    }
    case 'producto.creado':
      unicoNombreProducto(estado, evento.datos);
      return;
    case 'producto.editado': {
      producto(estado, evento.datos.productoId);
      unicoNombreProducto(estado, evento.datos.cambios, evento.datos.productoId);
      return;
    }
    case 'producto.archivado':
      producto(estado, evento.datos.productoId);
      return;
    case 'inventario.ajuste': {
      const d = evento.datos;
      const p = producto(estado, d.productoId, false);
      const actual = stockDe(estado, d.productoId);
      if (d.motivo !== 'conteo' && d.delta === 0) falla('El ajuste no cambia nada: la cantidad es cero.');
      if (d.motivo === 'conteo' && (d.antes === undefined || d.despues === undefined)) falla('Un conteo dice cuánto había y cuánto contaste.');
      if (d.antes !== undefined && d.antes !== actual) {
        falla(`La existencia de «${p.nombre}» cambió mientras contabas (ahora ${mostrarCantidad(actual)}). Vuelve a contar.`);
      }
      if (d.antes !== undefined && d.despues !== undefined && d.despues !== d.antes + d.delta) falla('El ajuste no cuadra (antes + cambio ≠ después).');
      if (d.motivo === 'conteo' && d.despues !== undefined && d.despues < 0) falla('Un conteo no puede dar negativo.');
      return;
    }
    case 'caja.abierta':
      if (estado.caja) falla('Ya hay una caja abierta. Ciérrala antes de abrir otra.');
      return;
    case 'caja.movimiento': {
      const caja = cajaAbierta(estado, 'mover plata');
      if (evento.datos.tipo === 'retiro' && evento.datos.monto > esperadoCaja(caja)) {
        falla(`No puedes retirar más de lo que hay en la caja según el cuadre (${pesos(esperadoCaja(caja))}). Revisa la cifra o registra primero el ingreso que falta.`);
      }
      return;
    }
    case 'caja.cerrada': {
      const d = evento.datos;
      const caja = cajaAbierta(estado, 'cerrarla');
      if (d.cajaId !== caja.id) falla('Esa caja ya no está abierta.');
      if (!d.confirmado) falla('Revisa el resumen del cierre y confírmalo para cerrar la caja.');
      if (d.esperado !== esperadoCaja(caja)) falla('La caja cambió desde que viste el resumen. Vuelve a mirarlo y a contar.');
      if (d.diferencia !== d.contado - d.esperado) falla('La diferencia no cuadra con lo contado.');
      const abiertas = Object.keys(estado.cuentas).length;
      if (abiertas > 0) {
        falla(abiertas === 1
          ? 'Hay una mesa con la cuenta abierta. Cóbrala (o anúlala) antes de cerrar la caja.'
          : `Hay ${abiertas} mesas con la cuenta abierta. Cóbralas (o anúlalas) antes de cerrar la caja.`);
      }
      if (caja.actividad === 0 && !d.nota) falla('Esta caja no tuvo movimientos. Escribe el motivo del cierre (por ejemplo: «la abrí por error»).');
      return;
    }
    case 'venta.registrada':
      validarVenta(estado, evento);
      return;
    case 'venta.anulada': {
      const v = estado.ventas[evento.datos.ventaId] ?? falla('Esa venta es de una caja ya cerrada (o no existe): no se puede anular. Si hubo un error, haz un ajuste de inventario con nota.');
      if (v.anulada) falla('Esa venta ya está anulada.');
      return;
    }
    case 'compra.registrada': {
      const d = evento.datos;
      sinRepetidos(d.lineas.map((l) => l.productoId), 'la factura');
      for (const l of d.lineas) producto(estado, l.productoId);
      const total = d.lineas.reduce((s, l) => s + importe(l.cantidad, l.costoUnit), 0);
      if (d.total !== total) falla('El total de la factura no cuadra con sus líneas.');
      if (d.vence !== undefined && d.vence < d.fecha) falla('La factura no puede vencer antes de su fecha.');
      const repetida = Object.values(estado.compras).find(
        (c) => c.estado !== 'anulada' && norma(c.proveedor) === norma(d.proveedor) && norma(c.numero) === norma(d.numero),
      );
      if (repetida) falla(`La factura ${d.numero} de ${d.proveedor} ya está registrada.`);
      return;
    }
    case 'compra.aplicada': {
      const c = estado.compras[evento.datos.compraId] ?? falla('Esa factura no existe.');
      if (c.estado === 'aplicada') falla('Esa factura ya se aplicó al inventario: no se suma dos veces.');
      if (c.estado === 'anulada') falla('Esa factura está anulada: no se puede aplicar.');
      for (const l of c.lineas) producto(estado, l.productoId, false);
      return;
    }
    case 'compra.anulada': {
      const c = estado.compras[evento.datos.compraId] ?? falla('Esa factura no existe.');
      if (c.estado === 'aplicada') falla('Esa factura ya entró al inventario: no se puede anular. Corrige con un ajuste de inventario.');
      if (c.estado === 'anulada') falla('Esa factura ya está anulada.');
      if (c.pagado > 0) falla('Esa factura ya tiene pagos: no se puede anular.');
      return;
    }
    case 'pago.factura': {
      const d = evento.datos;
      const c = estado.compras[d.compraId] ?? falla('Esa factura no existe.');
      if (c.estado === 'anulada') falla('Esa factura está anulada: no se le paga.');
      if (c.saldo === 0) falla('Esa factura ya está pagada.');
      if (d.monto > c.saldo) falla(`El pago (${pesos(d.monto)}) es mayor que el saldo de la factura (${pesos(c.saldo)}).`);
      if (d.deCaja) salidaDeCaja(estado, d.forma, d.monto, 'la factura');
      return;
    }
    case 'gasto.registrado':
      if (evento.datos.deCaja) salidaDeCaja(estado, evento.datos.forma, evento.datos.monto, 'el gasto');
      return;
    case 'gasto.anulado': {
      const g = estado.gastos[evento.datos.gastoId] ?? falla('Ese gasto no existe.');
      if (g.anulado) falla('Ese gasto ya está anulado.');
      if (g.deCaja && g.cajaId !== estado.caja?.id) falla('Ese gasto salió de una caja ya cerrada: no se puede anular.');
      return;
    }
    case 'mesa.creada': {
      const d = evento.datos;
      const activas = Object.values(estado.mesas).filter((m) => m.activa);
      if (activas.length >= LIMITES.mesas) falla(`El mapa admite hasta ${LIMITES.mesas} mesas.`);
      if (activas.some((m) => norma(m.nombre) === norma(d.nombre))) falla(`Ya hay una mesa llamada «${d.nombre}».`);
      return;
    }
    case 'mesa.retirada': {
      const m = mesa(estado, evento.datos.mesaId);
      if (cuentaDeMesa(estado, m.id)) falla(`«${m.nombre}» tiene la cuenta abierta: cóbrala o anúlala antes de retirarla.`);
      return;
    }
    case 'cuenta.abierta':
      cajaAbierta(estado, 'atender mesas');
      mesaLibre(estado, evento.datos.mesaId);
      return;
    case 'cuenta.pedido': {
      const d = evento.datos;
      const c = cuenta(estado, d.cuentaId);
      sinRepetidos(d.lineas.map((l) => l.productoId), 'la ronda');
      for (const l of d.lineas) {
        const p = producto(estado, l.productoId);
        if (p.unidad === 'unidad' && l.cantidad % 1000 !== 0) falla(`«${p.nombre}» se pide por unidades enteras.`);
      }
      const productos = new Set([...c.lineas.map((l) => l.productoId), ...d.lineas.map((l) => l.productoId)]);
      if (productos.size > LIMITES.lineas) falla(`Una cuenta admite hasta ${LIMITES.lineas} productos distintos.`);
      return;
    }
    case 'cuenta.quitado': {
      const d = evento.datos;
      const c = cuenta(estado, d.cuentaId);
      const hay = pedidoEnCuenta(c, d.productoId);
      const nombre = estado.productos[d.productoId]?.nombre ?? 'ese producto';
      if (hay === 0) falla(`La cuenta no tiene «${nombre}».`);
      if (d.cantidad > hay) falla(`La cuenta sólo tiene ${mostrarCantidad(hay)} de «${nombre}».`);
      return;
    }
    case 'cuenta.precuenta': {
      const c = cuenta(estado, evento.datos.cuentaId);
      if (c.precuenta === evento.datos.pedida) falla(evento.datos.pedida ? 'Esa mesa ya pidió la cuenta.' : 'Esa mesa no había pedido la cuenta.');
      return;
    }
    case 'cuenta.trasladada': {
      const c = cuenta(estado, evento.datos.cuentaId);
      if (c.mesaId === evento.datos.mesaId) falla('La cuenta ya está en esa mesa.');
      mesaLibre(estado, evento.datos.mesaId);
      return;
    }
    case 'cuenta.liberada': {
      const c = cuenta(estado, evento.datos.cuentaId);
      if (c.lineas.length > 0) falla('La cuenta tiene pedidos: cóbrala, o quita lo pedido con su motivo.');
      return;
    }
    case 'cuenta.anulada': {
      const c = cuenta(estado, evento.datos.cuentaId);
      if (c.lineas.length === 0) falla('La cuenta está vacía: libera la mesa (no hace falta anularla).');
      return;
    }
  }
}

// --- Proyección -----------------------------------------------------------------

function conStock(estado: EstadoNegocio, cambios: ReadonlyArray<readonly [string, number]>): EstadoNegocio['stock'] {
  const stock = { ...estado.stock };
  for (const [id, delta] of cambios) stock[id] = milesimas((stock[id] ?? 0) + delta);
  return stock;
}

function sumarForma(base: PorForma, pagos: readonly PagoVenta[], signo: 1 | -1): PorForma {
  const r = { ...base };
  for (const p of pagos) r[p.forma] = centavos(r[p.forma] + signo * p.monto);
  return r;
}

function conCaja(estado: EstadoNegocio, cambio: (c: CajaAbierta) => Partial<CajaAbierta>): CajaAbierta | null {
  // Si no hay caja (no debería pasar: `validar` lo impide) el estado queda igual.
  return estado.caja ? { ...estado.caja, ...cambio(estado.caja), actividad: estado.caja.actividad + 1 } : null;
}

function datosAProducto(id: string, d: DatosProducto, activo: boolean): Producto {
  const p: Producto = {
    id,
    nombre: d.nombre,
    categoria: d.categoria,
    unidad: d.unidad,
    precio: d.precio,
    costo: d.costo,
    stockMinimo: d.stockMinimo,
    activo,
  };
  return d.codigo ? { ...p, codigo: d.codigo } : p;
}

/** Suma (o resta) cantidades a las líneas de una cuenta; las que llegan a cero salen. */
function conLineas(lineas: readonly LineaCuenta[], cambios: readonly LineaCuenta[], signo: 1 | -1): LineaCuenta[] {
  const r = lineas.map((l) => ({ ...l }));
  for (const c of cambios) {
    const l = r.find((x) => x.productoId === c.productoId);
    if (l) l.cantidad = milesimas(l.cantidad + signo * c.cantidad);
    else if (signo === 1) r.push({ ...c });
  }
  return r.filter((l) => l.cantidad > 0);
}

function sinCuenta(estado: EstadoNegocio, id: string): EstadoNegocio['cuentas'] {
  return Object.fromEntries(Object.entries(estado.cuentas).filter(([k]) => k !== id));
}

function conCuenta(estado: EstadoNegocio, id: string, cambio: (c: Cuenta) => Partial<Cuenta>): EstadoNegocio['cuentas'] {
  const c = estado.cuentas[id];
  return c ? { ...estado.cuentas, [id]: { ...c, ...cambio(c) } } : estado.cuentas;
}

function siguiente(estado: EstadoNegocio, evento: Evento): EstadoNegocio {
  switch (evento.tipo) {
    case 'usuario.creado': {
      const u: Usuario = { id: evento.id, nombre: evento.datos.nombre, rol: evento.datos.rol, activo: true, pin: evento.datos.pin };
      return { ...estado, usuarios: { ...estado.usuarios, [u.id]: u } };
    }
    case 'usuario.pin':
    case 'usuario.desactivado': {
      const u = estado.usuarios[evento.datos.usuarioId];
      if (!u) return estado;
      const nuevo = evento.tipo === 'usuario.pin' ? { ...u, pin: evento.datos.pin } : { ...u, activo: false };
      return { ...estado, usuarios: { ...estado.usuarios, [u.id]: nuevo } };
    }
    case 'producto.creado':
      return {
        ...estado,
        productos: { ...estado.productos, [evento.id]: datosAProducto(evento.id, evento.datos, true) },
        stock: { ...estado.stock, [evento.id]: milesimas(0) },
      };
    case 'producto.editado': {
      const p = estado.productos[evento.datos.productoId];
      if (!p) return estado;
      const actual: DatosProducto = { ...p, codigo: p.codigo ?? null };
      const nuevo = datosAProducto(p.id, { ...actual, ...evento.datos.cambios }, p.activo);
      return { ...estado, productos: { ...estado.productos, [p.id]: nuevo } };
    }
    case 'producto.archivado': {
      const p = estado.productos[evento.datos.productoId];
      if (!p) return estado;
      return { ...estado, productos: { ...estado.productos, [p.id]: { ...p, activo: false } } };
    }
    case 'inventario.ajuste':
      return { ...estado, stock: conStock(estado, [[evento.datos.productoId, evento.datos.delta]]) };
    case 'caja.abierta':
      return {
        ...estado,
        caja: {
          id: evento.id,
          base: evento.datos.base,
          abiertaEn: evento.en,
          abiertaPor: evento.por,
          ventasPorForma: porFormaVacio(),
          ventas: 0,
          anuladas: 0,
          ingresos: CERO,
          retiros: CERO,
          gastos: CERO,
          pagos: CERO,
          actividad: 0,
        },
        ventas: {},
      };
    case 'caja.movimiento': {
      const { tipo, monto } = evento.datos;
      return {
        ...estado,
        caja: conCaja(estado, (c) =>
          tipo === 'ingreso' ? { ingresos: centavos(c.ingresos + monto) } : { retiros: centavos(c.retiros + monto) },
        ),
      };
    }
    case 'caja.cerrada': {
      const caja = estado.caja;
      if (!caja) return estado;
      const d = evento.datos;
      const cerrada: CajaCerrada = {
        ...caja,
        cerradaEn: evento.en,
        cerradaPor: evento.por,
        esperado: d.esperado,
        contado: d.contado,
        diferencia: d.diferencia,
        nota: d.nota ?? null,
      };
      return { ...estado, caja: null, cierres: [...estado.cierres, cerrada], ventas: {} };
    }
    case 'venta.registrada': {
      const d = evento.datos;
      const venta: Venta = {
        id: evento.id,
        cajaId: d.cajaId,
        en: evento.en,
        por: evento.por,
        lineas: d.lineas,
        descuento: d.descuento ?? null,
        total: d.total,
        pagos: d.pagos,
        recibido: d.recibido ?? null,
        cambio: d.cambio ?? null,
        anulada: false,
        motivoAnulacion: null,
      };
      return {
        ...estado,
        stock: conStock(estado, d.lineas.map((l) => [l.productoId, -l.cantidad] as const)),
        ventas: { ...estado.ventas, [venta.id]: venta },
        caja: conCaja(estado, (c) => ({ ventasPorForma: sumarForma(c.ventasPorForma, d.pagos, 1), ventas: c.ventas + 1 })),
        cuentas: d.cuentaId === undefined ? estado.cuentas : sinCuenta(estado, d.cuentaId),
      };
    }
    case 'venta.anulada': {
      const v = estado.ventas[evento.datos.ventaId];
      if (!v) return estado;
      return {
        ...estado,
        stock: conStock(estado, v.lineas.map((l) => [l.productoId, l.cantidad] as const)),
        ventas: { ...estado.ventas, [v.id]: { ...v, anulada: true, motivoAnulacion: evento.datos.motivo } },
        caja: conCaja(estado, (c) => ({
          ventasPorForma: sumarForma(c.ventasPorForma, v.pagos, -1),
          ventas: c.ventas - 1,
          anuladas: c.anuladas + 1,
        })),
      };
    }
    case 'compra.registrada': {
      const d = evento.datos;
      const compra: Compra = {
        id: evento.id,
        proveedor: d.proveedor,
        numero: d.numero,
        fecha: d.fecha,
        vence: d.vence ?? null,
        lineas: d.lineas,
        total: d.total,
        adjuntos: d.adjuntos,
        nota: d.nota ?? null,
        registradaEn: evento.en,
        por: evento.por,
        estado: 'registrada',
        aplicadaEn: null,
        pagado: CERO,
        saldo: d.total,
      };
      return { ...estado, compras: { ...estado.compras, [compra.id]: compra } };
    }
    case 'compra.aplicada': {
      const c = estado.compras[evento.datos.compraId];
      if (!c) return estado;
      // La única puerta de la mercancía: entra el stock y el costo pasa a ser el último.
      const productos = { ...estado.productos };
      for (const l of c.lineas) {
        const p = productos[l.productoId];
        if (p) productos[p.id] = { ...p, costo: l.costoUnit };
      }
      return {
        ...estado,
        productos,
        stock: conStock(estado, c.lineas.map((l) => [l.productoId, l.cantidad] as const)),
        compras: { ...estado.compras, [c.id]: { ...c, estado: 'aplicada', aplicadaEn: evento.en } },
      };
    }
    case 'compra.anulada': {
      const c = estado.compras[evento.datos.compraId];
      if (!c) return estado;
      return { ...estado, compras: { ...estado.compras, [c.id]: { ...c, estado: 'anulada', saldo: CERO } } };
    }
    case 'pago.factura': {
      const d = evento.datos;
      const c = estado.compras[d.compraId];
      if (!c) return estado;
      const pagado = centavos(c.pagado + d.monto);
      return {
        ...estado,
        compras: { ...estado.compras, [c.id]: { ...c, pagado, saldo: centavos(c.total - pagado) } },
        caja: d.deCaja ? conCaja(estado, (k) => ({ pagos: centavos(k.pagos + d.monto) })) : estado.caja,
      };
    }
    case 'gasto.registrado': {
      const d = evento.datos;
      const gasto: Gasto = {
        id: evento.id,
        categoria: d.categoria,
        descripcion: d.descripcion,
        monto: d.monto,
        forma: d.forma,
        deCaja: d.deCaja,
        cajaId: d.deCaja ? (estado.caja?.id ?? null) : null,
        adjunto: d.adjunto ?? null,
        en: evento.en,
        por: evento.por,
        anulado: false,
      };
      return {
        ...estado,
        gastos: { ...estado.gastos, [gasto.id]: gasto },
        caja: d.deCaja ? conCaja(estado, (k) => ({ gastos: centavos(k.gastos + d.monto) })) : estado.caja,
      };
    }
    case 'gasto.anulado': {
      const g = estado.gastos[evento.datos.gastoId];
      if (!g) return estado;
      const devuelve = g.deCaja && g.cajaId !== null && g.cajaId === estado.caja?.id;
      return {
        ...estado,
        gastos: { ...estado.gastos, [g.id]: { ...g, anulado: true } },
        caja: devuelve ? conCaja(estado, (k) => ({ gastos: centavos(k.gastos - g.monto) })) : estado.caja,
      };
    }
    case 'mesa.creada': {
      const m: Mesa = { id: evento.id, nombre: evento.datos.nombre, zona: evento.datos.zona, activa: true };
      return { ...estado, mesas: { ...estado.mesas, [m.id]: m } };
    }
    case 'mesa.retirada': {
      const m = estado.mesas[evento.datos.mesaId];
      if (!m) return estado;
      return { ...estado, mesas: { ...estado.mesas, [m.id]: { ...m, activa: false } } };
    }
    case 'cuenta.abierta': {
      const c: Cuenta = {
        id: evento.id,
        mesaId: evento.datos.mesaId,
        abiertaEn: evento.en,
        abiertaPor: evento.por,
        personas: evento.datos.personas ?? null,
        lineas: [],
        rondas: 0,
        ultimoPedidoEn: null,
        precuenta: false,
      };
      return { ...estado, cuentas: { ...estado.cuentas, [c.id]: c } };
    }
    case 'cuenta.pedido':
      return {
        ...estado,
        cuentas: conCuenta(estado, evento.datos.cuentaId, (c) => ({
          lineas: conLineas(c.lineas, evento.datos.lineas, 1),
          rondas: c.rondas + 1,
          ultimoPedidoEn: evento.en,
          // Pidieron algo más: ya no está esperando la cuenta.
          precuenta: false,
        })),
      };
    case 'cuenta.quitado': {
      const d = evento.datos;
      return {
        ...estado,
        cuentas: conCuenta(estado, d.cuentaId, (c) => ({
          lineas: conLineas(c.lineas, [{ productoId: d.productoId, cantidad: d.cantidad }], -1),
        })),
      };
    }
    case 'cuenta.precuenta':
      return { ...estado, cuentas: conCuenta(estado, evento.datos.cuentaId, () => ({ precuenta: evento.datos.pedida })) };
    case 'cuenta.trasladada':
      return { ...estado, cuentas: conCuenta(estado, evento.datos.cuentaId, () => ({ mesaId: evento.datos.mesaId })) };
    case 'cuenta.liberada':
    case 'cuenta.anulada':
      return { ...estado, cuentas: sinCuenta(estado, evento.datos.cuentaId) };
  }
}

/**
 * Estado después del evento. Puro: no toca `estado`. `hash` es el del registro en el
 * diario (si se omite, se conserva el último conocido).
 */
export function aplicar(estado: EstadoNegocio, evento: Evento, hash?: string): EstadoNegocio {
  return {
    ...siguiente(estado, evento),
    eventos: estado.eventos + 1,
    ultimoId: evento.id,
    ultimoHash: hash ?? estado.ultimoHash,
  };
}

/** Repite una lista de eventos desde un estado (vacío por defecto). */
export function proyectar(eventos: Iterable<Evento>, desde: EstadoNegocio = estadoVacio()): EstadoNegocio {
  let estado = desde;
  for (const e of eventos) estado = aplicar(estado, e);
  return estado;
}

// --- Alertas ---------------------------------------------------------------------

export interface Alerta {
  readonly productoId: string;
  readonly nombre: string;
  readonly tipo: 'negativo' | 'bajoMinimo';
  readonly stock: Milesimas;
  readonly minimo: Milesimas | null;
}

/**
 * Productos activos con existencia negativa (hay que contar o registrar una factura) o en
 * el mínimo o por debajo (hay que pedir). Ordenadas: primero negativos, luego por nombre.
 */
export function alertas(estado: EstadoNegocio): Alerta[] {
  const r: Alerta[] = [];
  for (const p of Object.values(estado.productos)) {
    if (!p.activo) continue;
    const stock = stockDe(estado, p.id);
    if (stock < 0) r.push({ productoId: p.id, nombre: p.nombre, tipo: 'negativo', stock, minimo: p.stockMinimo });
    else if (p.stockMinimo !== null && stock <= p.stockMinimo) {
      r.push({ productoId: p.id, nombre: p.nombre, tipo: 'bajoMinimo', stock, minimo: p.stockMinimo });
    }
  }
  return r.sort((a, b) => (a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre, 'es') : a.tipo === 'negativo' ? -1 : 1));
}
