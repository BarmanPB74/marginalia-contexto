import { PantallaCompras } from '../compras/PantallaCompras';
import { PantallaGastos } from '../gastos/PantallaGastos';
import { PantallaInventario } from '../inventario/PantallaInventario';
import type { RegistroPantallas } from './tipos';

/** Pantallas del área «inventario»: inventario (con importar), compras y facturas, gastos. */
export const PANTALLAS_INVENTARIO: RegistroPantallas = {
  inventario: PantallaInventario,
  compras: PantallaCompras,
  gastos: PantallaGastos,
};
