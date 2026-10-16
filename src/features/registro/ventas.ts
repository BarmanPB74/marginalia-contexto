import { PantallaCaja } from '../caja/PantallaCaja';
import { PantallaInicio } from '../inicio/PantallaInicio';
import { PantallaVender } from '../vender/PantallaVender';
import type { RegistroPantallas } from './tipos';

/** Pantallas del área «ventas» (agente ventas-caja): Inicio, Vender y Caja. */
export const PANTALLAS_VENTAS: RegistroPantallas = {
  inicio: PantallaInicio,
  vender: PantallaVender,
  caja: PantallaCaja,
};
