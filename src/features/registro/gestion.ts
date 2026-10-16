import { PantallaContabilidad } from '../contabilidad/PantallaContabilidad';
import { PantallaMas } from '../mas/PantallaMas';
import { PantallaUsuarios } from '../usuarios/PantallaUsuarios';
import type { RegistroPantallas } from './tipos';

/** Pantallas del área «gestion»: contabilidad, usuarios y el menú «Más». */
export const PANTALLAS_GESTION: RegistroPantallas = {
  contabilidad: PantallaContabilidad,
  usuarios: PantallaUsuarios,
  mas: PantallaMas,
};
