/**
 * Conteo por copas: una botella (unidad) rinde `porBotella` copas. Se cuenta en botellas
 * enteras y copas sueltas; el núcleo guarda milésimas de botella (enteros, sin decimales).
 */
import { milesimas, mostrarCantidad, type Milesimas, type Producto } from '../../core/negocio';

/** Botellas enteras + copas sueltas → milésimas de botella (redondeado a la milésima). */
export function desdeCopas(botellas: number, copas: number, porBotella: number): Milesimas {
  return milesimas(Math.round(((botellas * porBotella + copas) * 1000) / porBotella));
}

/** Existencias en botellas enteras y copas sueltas (las copas, redondeadas a la más cercana). */
export function enCopas(stock: Milesimas, porBotella: number): { botellas: number; copas: number; total: number } {
  const total = Math.round((stock * porBotella) / 1000);
  const botellas = Math.trunc(total / porBotella);
  return { botellas, copas: total - botellas * porBotella, total };
}

/** «3 und + 5 copas» o, sin copas configuradas, «3,2 und». */
export function textoExistencias(stock: Milesimas, p: Pick<Producto, 'copas'>, unidad: string): string {
  if (!p.copas) return `${mostrarCantidad(stock)} ${unidad}`;
  const { botellas, copas } = enCopas(stock, p.copas);
  if (copas === 0) return `${botellas} ${unidad}`;
  return `${botellas} ${unidad} + ${copas} ${copas === 1 ? 'copa' : 'copas'}`;
}

/** Lee «botellas» y «copas» escritos (vacío = 0). Lanza RangeError con el mensaje para la persona. */
export function leerBotellasYCopas(textoBotellas: string, textoCopas: string, porBotella: number): Milesimas {
  const b = textoBotellas.trim() === '' ? 0 : Number(textoBotellas.trim());
  const c = textoCopas.trim() === '' ? 0 : Number(textoCopas.trim().replace(',', '.'));
  if (!Number.isInteger(b) || b < 0) throw new RangeError('Botellas: escribe un número entero (0 o más).');
  if (!Number.isFinite(c) || c < 0) throw new RangeError('Copas: escribe un número (0 o más).');
  if (textoBotellas.trim() === '' && textoCopas.trim() === '') throw new RangeError('Escribe las botellas o las copas que hay.');
  return desdeCopas(b, c, porBotella);
}
