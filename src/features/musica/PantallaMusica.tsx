import { SpikeReproductor } from '../../spike/SpikeReproductor';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';

export function PantallaMusica() {
  return (
    <Pagina>
      <Encabezado titulo="Música" />
      <EstadoVacio mensaje="Sin canciones guardadas." pista="Las notas con ♪ canción aparecerán aquí." />
      {/* SPIKE F0: se borra al empezar F4 */}
      <SpikeReproductor />
    </Pagina>
  );
}
