import { OTRAS, type IdSeccion } from '../../app/rutas';
import type { Accion } from '../../core/negocio';
import type { NombreIcono } from '../../ui/Icono';

export interface TarjetaMas {
  id: IdSeccion;
  etiqueta: string;
  icono: NombreIcono;
  descripcion: string;
}

/**
 * Qué permiso abre cada sección de «Más» (basta uno). Sin entrada = cualquier cargo.
 * Los permisos salen de la tabla única del núcleo: aquí solo se elige cuál representa la sección.
 */
const ACCESO: Partial<Record<IdSeccion, readonly Accion[]>> = {
  caja: ['caja.abrir', 'caja.cerrar'],
  compras: ['compra.ver'],
  gastos: ['gasto.registrar', 'gasto.registrarDeCaja'],
  contabilidad: ['contabilidad.ver'],
  usuarios: ['usuario.crear'],
};

const DESCRIPCION: Partial<Record<IdSeccion, string>> = {
  caja: 'Abrir y cerrar la caja, entradas y retiros de efectivo.',
  compras: 'Facturas de proveedores, aplicarlas al inventario y pagarlas.',
  gastos: 'Arriendo, servicios, domicilios y lo que se paga con la caja.',
  contabilidad: 'Ventas, costos, margen, gastos y cuentas por pagar. Exportar CSV.',
  usuarios: 'Cajeros y bodega: crear, cambiar su PIN o desactivarlos.',
  calendario: 'Las notas de la bitácora por día.',
  ajustes: 'Tema, copias de seguridad, privacidad y datos del negocio.',
};

/** Tarjetas de «Más» que esta persona puede usar, en el orden de `OTRAS`. */
export function seccionesMas(puede: (accion: Accion) => boolean): TarjetaMas[] {
  const visibles: TarjetaMas[] = OTRAS.filter((s) => (ACCESO[s.id] ?? []).length === 0 || (ACCESO[s.id] ?? []).some(puede)).map(
    (s) => ({ ...s, descripcion: DESCRIPCION[s.id] ?? '' }),
  );
  // Quien no administra usuarios igual tiene su cuenta (cambiar su PIN) en la misma ruta
  if (!visibles.some((s) => s.id === 'usuarios')) {
    const i = visibles.findIndex((s) => s.id === 'ajustes');
    visibles.splice(i < 0 ? visibles.length : i, 0, {
      id: 'usuarios',
      etiqueta: 'Mi cuenta',
      icono: 'usuarios',
      descripcion: 'Cambiar tu PIN.',
    });
  }
  return visibles;
}
