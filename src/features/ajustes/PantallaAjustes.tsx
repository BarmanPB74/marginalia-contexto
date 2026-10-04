import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';

export function PantallaAjustes() {
  return (
    <Pagina>
      <Encabezado titulo="Ajustes" />
      <EstadoVacio mensaje="Nada que ajustar todavía." pista="Las opciones llegarán junto con las funciones." />
    </Pagina>
  );
}
