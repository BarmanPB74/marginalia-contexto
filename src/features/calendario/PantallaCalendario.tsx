import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';

export function PantallaCalendario() {
  return (
    <Pagina>
      <Encabezado titulo="Calendario" />
      <EstadoVacio mensaje="Ningún día marcado todavía." pista="Las notas con una @fecha aparecerán en su día." />
    </Pagina>
  );
}
