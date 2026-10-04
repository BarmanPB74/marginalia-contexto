import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';

export function PantallaNotas() {
  return (
    <Pagina>
      <Encabezado titulo="Notas" />
      <EstadoVacio mensaje="Aún no hay notas." pista="Cuando escribas la primera, aparecerá aquí." />
    </Pagina>
  );
}
