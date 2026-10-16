/**
 * Permisos de Bar Box: UNA tabla, como `usuarios.puede` de Bar_box.
 *
 * Cada acción dice qué cargos la pueden hacer. El dueño puede todo (la tabla lo repite
 * para que se lea sola). Acción nueva = decidir de quién es: el compilador obliga a
 * ponerla en la tabla (`Record<Accion, …>`) y una prueba verifica que toda acción esté
 * clasificada y que el dueño las tenga todas.
 *
 * - Cajero: abre y cierra caja, vende, mueve plata de la caja, registra gastos pagados de
 *   la caja y ve el inventario SIN costos.
 * - Bodega: inventario (ajustes, conteos, facturas de compra, importar), sin ventas ni
 *   contabilidad.
 * - Sólo dueño: anular ventas, precios y costos, usuarios, contabilidad y pagos.
 */
import type { Rol } from './modelo';
import type { Evento } from './eventos';

export const ACCIONES = [
  'caja.abrir',
  'caja.cerrar',
  'caja.movimiento',
  'venta.registrar',
  'venta.anular',
  'inventario.ver',
  'inventario.verCostos',
  'inventario.ajustar',
  'inventario.contar',
  'inventario.importar',
  'producto.crear',
  'producto.editar',
  'producto.editarPrecio',
  'producto.archivar',
  'compra.ver',
  'compra.registrar',
  'compra.aplicar',
  'compra.anular',
  'pago.factura',
  'gasto.registrar',
  'gasto.registrarDeCaja',
  'gasto.anular',
  'contabilidad.ver',
  'contabilidad.exportar',
  'usuario.crear',
  'usuario.desactivar',
  'usuario.cambiarPinPropio',
  'usuario.cambiarPinOtro',
  'diario.verificar',
] as const;

export type Accion = (typeof ACCIONES)[number];

const TODOS: readonly Rol[] = ['dueno', 'cajero', 'bodega'];
const DUENO: readonly Rol[] = ['dueno'];
const SALA: readonly Rol[] = ['dueno', 'cajero'];
const BODEGA: readonly Rol[] = ['dueno', 'bodega'];

/** La tabla. Única respuesta a «¿quién puede hacer esto?». */
export const PERMISOS: Readonly<Record<Accion, readonly Rol[]>> = {
  'caja.abrir': SALA,
  'caja.cerrar': SALA,
  'caja.movimiento': SALA,
  'venta.registrar': SALA,
  'venta.anular': DUENO,
  'inventario.ver': TODOS,
  'inventario.verCostos': BODEGA,
  'inventario.ajustar': BODEGA,
  'inventario.contar': BODEGA,
  'inventario.importar': BODEGA,
  // Crear un producto fija su precio: sólo el dueño. Bodega puede corregir nombre,
  // categoría, unidad, mínimo y código.
  'producto.crear': DUENO,
  'producto.editar': BODEGA,
  'producto.editarPrecio': DUENO,
  'producto.archivar': DUENO,
  'compra.ver': BODEGA,
  'compra.registrar': BODEGA,
  // Aplicar la factura cambia el costo al último: es la puerta de la mercancía y bodega
  // es quien la recibe.
  'compra.aplicar': BODEGA,
  'compra.anular': DUENO,
  'pago.factura': DUENO,
  'gasto.registrar': DUENO,
  'gasto.registrarDeCaja': SALA,
  'gasto.anular': DUENO,
  'contabilidad.ver': DUENO,
  'contabilidad.exportar': DUENO,
  'usuario.crear': DUENO,
  'usuario.desactivar': DUENO,
  'usuario.cambiarPinPropio': TODOS,
  'usuario.cambiarPinOtro': DUENO,
  'diario.verificar': DUENO,
};

/** Cómo se dice cada acción en un mensaje («Tu cargo no permite …»). */
export const NOMBRE_ACCION: Readonly<Record<Accion, string>> = {
  'caja.abrir': 'abrir la caja',
  'caja.cerrar': 'cerrar la caja',
  'caja.movimiento': 'mover plata de la caja',
  'venta.registrar': 'vender',
  'venta.anular': 'anular ventas',
  'inventario.ver': 'ver el inventario',
  'inventario.verCostos': 'ver costos',
  'inventario.ajustar': 'ajustar el inventario',
  'inventario.contar': 'contar el inventario',
  'inventario.importar': 'importar inventario',
  'producto.crear': 'crear productos',
  'producto.editar': 'editar productos',
  'producto.editarPrecio': 'cambiar precios o costos',
  'producto.archivar': 'archivar productos',
  'compra.ver': 'ver facturas de compra',
  'compra.registrar': 'registrar facturas de compra',
  'compra.aplicar': 'aplicar facturas al inventario',
  'compra.anular': 'anular facturas de compra',
  'pago.factura': 'pagar facturas',
  'gasto.registrar': 'registrar gastos',
  'gasto.registrarDeCaja': 'pagar gastos con la caja',
  'gasto.anular': 'anular gastos',
  'contabilidad.ver': 'ver la contabilidad',
  'contabilidad.exportar': 'exportar la contabilidad',
  'usuario.crear': 'crear usuarios',
  'usuario.desactivar': 'desactivar usuarios',
  'usuario.cambiarPinPropio': 'cambiar tu PIN',
  'usuario.cambiarPinOtro': 'cambiar el PIN de otra persona',
  'diario.verificar': 'verificar el diario',
};

/** ¿Este cargo puede hacer esta acción? Un cargo o acción desconocidos: no. */
export function puede(rol: Rol, accion: Accion): boolean {
  return Object.hasOwn(PERMISOS, accion) && PERMISOS[accion].includes(rol);
}

/**
 * Qué acción representa un evento (según su autor `por` y sus datos). El servicio la consulta antes
 * de escribir: el permiso se decide por lo que pasa, no por el botón que se tocó.
 */
export function accionDe(evento: Evento): Accion {
  switch (evento.tipo) {
    case 'usuario.creado':
      return 'usuario.crear';
    case 'usuario.pin':
      return evento.datos.usuarioId === evento.por ? 'usuario.cambiarPinPropio' : 'usuario.cambiarPinOtro';
    case 'usuario.desactivado':
      return 'usuario.desactivar';
    case 'producto.creado':
      return 'producto.crear';
    case 'producto.editado': {
      const c = evento.datos.cambios;
      return c.precio !== undefined || c.costo !== undefined ? 'producto.editarPrecio' : 'producto.editar';
    }
    case 'producto.archivado':
      return 'producto.archivar';
    case 'inventario.ajuste':
      return evento.datos.motivo === 'conteo'
        ? 'inventario.contar'
        : evento.datos.motivo === 'importacion'
          ? 'inventario.importar'
          : 'inventario.ajustar';
    case 'caja.abierta':
      return 'caja.abrir';
    case 'caja.movimiento':
      return 'caja.movimiento';
    case 'caja.cerrada':
      return 'caja.cerrar';
    case 'venta.registrada':
      return 'venta.registrar';
    case 'venta.anulada':
      return 'venta.anular';
    case 'compra.registrada':
      return 'compra.registrar';
    case 'compra.aplicada':
      return 'compra.aplicar';
    case 'compra.anulada':
      return 'compra.anular';
    case 'pago.factura':
      return 'pago.factura';
    case 'gasto.registrado':
      return evento.datos.deCaja ? 'gasto.registrarDeCaja' : 'gasto.registrar';
    case 'gasto.anulado':
      return 'gasto.anular';
  }
}
