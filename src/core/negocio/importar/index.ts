/**
 * Importar inventario (Excel o CSV): API pública.
 * Flujo: `leerTabla` → `buscarFilaEncabezado` + `detectarColumnas` (la persona corrige con
 * `listarColumnas`) → `filasImportables` → `planImportacion` → la UI confirma y otro módulo
 * convierte el plan en eventos.
 */
export { leerTabla, detectarFormato, type FormatoTabla } from './leer-tabla';
export {
  detectarColumnas,
  buscarFilaEncabezado,
  listarColumnas,
  normalizarEncabezado,
  letraColumna,
  type Columna,
} from './columnas';
export { leerNumero, leerEscalado, convencionDe, detectarConvencion } from './numero';
export { filasImportables, type OpcionesFilas, type ResultadoFilas } from './filas';
export {
  planImportacion,
  type AccionImportacion,
  type ModoImportacion,
  type ProductoExistente,
} from './plan';
export { normalizarNombre, normalizarCodigo } from './texto';
export {
  ErrorImportacion,
  LIMITES,
  type Tabla,
  type CampoImportable,
  type MapeoColumnas,
  type Convencion,
  type FilaImportable,
  type ErrorFila,
  type Milesimas,
  type Centavos,
} from './tipos';
