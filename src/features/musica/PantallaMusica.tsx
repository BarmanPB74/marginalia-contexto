import { useEstado } from '../../app/estado';
import { SpikeReproductor } from '../../spike/SpikeReproductor';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Pagina } from '../../ui/Pagina';
import { CANCION_DEMO } from './demo';
import { Reproductor } from './Reproductor';

export function PantallaMusica() {
  const { sonando, alternar, abrirComandos } = useEstado();
  return (
    <Pagina>
      <Encabezado
        titulo="Música"
        iconos={[{ icono: 'buscar', etiqueta: 'Buscar y comandos', alTocar: () => abrirComandos(true) }]}
      />
      <Reproductor {...CANCION_DEMO} sonando={sonando} alAlternar={alternar} />
      <EstadoVacio mensaje="Sin canciones guardadas." pista="Las notas con ♪ canción aparecerán aquí." />
      {/* SPIKE F0: se borra al empezar F4 */}
      <SpikeReproductor />
    </Pagina>
  );
}
