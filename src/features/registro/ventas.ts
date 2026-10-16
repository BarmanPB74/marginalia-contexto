import { PantallaCaja } from '../caja/PantallaCaja';
import { PantallaInicio } from '../inicio/PantallaInicio';
import { PantallaMesas } from '../mesas/PantallaMesas';
import { PantallaVender } from '../vender/PantallaVender';
import type { RegistroPantallas } from './tipos';

/** Pantallas del área «ventas» (agente ventas-caja): Inicio, Mesas, Vender y Caja. */
export const PANTALLAS_VENTAS: RegistroPantallas = {
  inicio: PantallaInicio,
  mesas: PantallaMesas,
  vender: PantallaVender,
  caja: PantallaCaja,
};
