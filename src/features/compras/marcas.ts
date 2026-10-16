/**
 * Estado visible de una factura de compra (puro). Una factura puede estar a la vez «aplicada» y
 * «con saldo», o «por aplicar» y «vencida»: por eso son marcas, no un solo estado.
 */
import type { Compra } from '../../core/negocio';
import type { TonoInsignia } from '../../ui/Insignia';

export type Marca = 'porAplicar' | 'aplicada' | 'pagada' | 'conSaldo' | 'vencida' | 'anulada';

export const MARCAS: readonly Marca[] = ['porAplicar', 'aplicada', 'conSaldo', 'vencida', 'pagada', 'anulada'];

export const NOMBRE_MARCA: Readonly<Record<Marca, string>> = {
  porAplicar: 'Registrada (por aplicar)',
  aplicada: 'Aplicada',
  pagada: 'Pagada',
  conSaldo: 'Con saldo',
  vencida: 'Vencida',
  anulada: 'Anulada',
};

export const TONO_MARCA: Readonly<Record<Marca, TonoInsignia>> = {
  porAplicar: 'aviso',
  aplicada: 'primario',
  pagada: 'exito',
  conSaldo: 'info',
  vencida: 'peligro',
  anulada: 'neutro',
};

/** Marcas de una factura hoy (`hoy` = 'AAAA-MM-DD'). */
export function marcasDe(c: Compra, hoy: string): Marca[] {
  if (c.estado === 'anulada') return ['anulada'];
  const r: Marca[] = [c.estado === 'aplicada' ? 'aplicada' : 'porAplicar'];
  if (c.saldo === 0) r.push('pagada');
  else {
    r.push('conSaldo');
    if (c.vence !== null && c.vence < hoy) r.push('vencida');
  }
  return r;
}
