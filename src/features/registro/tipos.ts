import type { FunctionComponent } from 'preact';
import type { IdSeccion } from '../../app/rutas';

/** Pantallas que aporta cada área. `App` junta los tres registros (ventas, inventario, gestión). */
export type RegistroPantallas = Partial<Record<IdSeccion, FunctionComponent>>;
