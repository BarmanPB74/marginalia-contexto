import { useState } from 'preact/hooks';
import { mostrarCantidad, pesos, type Venta } from '../../core/negocio';
import { CampoTexto } from '../../ui/CampoTexto';
import { Dialogo } from '../../ui/Dialogo';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Insignia } from '../../ui/Insignia';
import { Tabla, type Columna } from '../../ui/Tabla';
import { useNegocio } from '../negocio/contexto';
import { FORMA_CORTA, hora, useOperacion } from '../caja/comun';

/**
 * Ventas de la caja abierta (las únicas anulables, NEGOCIO §4.2). «Anular» sólo aparece si el
 * cargo puede (el dueño) y pide motivo; el núcleo devuelve el inventario.
 */
export function VentasHoy() {
  const { negocio, estado } = useNegocio();
  const [anulando, setAnulando] = useState<Venta | null>(null);
  const [motivo, setMotivo] = useState('');
  const [hecho, setHecho] = useState('');
  const { error, setError, correr } = useOperacion();
  const puedeAnular = negocio.puede('venta.anular');
  const ventas = Object.values(estado.ventas).sort((a, b) => (a.en < b.en ? 1 : -1));

  if (ventas.length === 0) {
    return <EstadoVacio mensaje="Todavía no hay ventas en esta caja." pista="Las ventas que registres aparecen aquí hasta cerrar la caja." />;
  }

  const columnas: Columna<Venta>[] = [
    { clave: 'hora', titulo: 'Hora', celda: (v) => hora(v.en), principal: true },
    {
      clave: 'productos',
      titulo: 'Productos',
      celda: (v) => v.lineas.map((l) => `${mostrarCantidad(l.cantidad)} × ${l.nombre}`).join(', '),
    },
    { clave: 'formas', titulo: 'Pago', celda: (v) => v.pagos.map((p) => FORMA_CORTA[p.forma]).join(' + ') || '—' },
    {
      clave: 'total',
      titulo: 'Total',
      numerica: true,
      celda: (v) => (v.anulada ? <s>{pesos(v.total)}</s> : pesos(v.total)),
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      celda: (v) =>
        v.anulada ? (
          <Insignia tono="peligro">Anulada</Insignia>
        ) : puedeAnular ? (
          <button
            type="button"
            class="boton boton--texto ventas-hoy__anular"
            aria-label={`Anular la venta de las ${hora(v.en)} por ${pesos(v.total)}`}
            onClick={() => {
              setAnulando(v);
              setMotivo('');
              setError(undefined);
            }}
          >
            Anular
          </button>
        ) : (
          <Insignia tono="exito">Vigente</Insignia>
        ),
    },
  ];

  async function anular() {
    if (!anulando) return;
    if (!motivo.trim()) {
      setError('Escribe el motivo de la anulación.');
      return;
    }
    const v = anulando;
    if (await correr(() => negocio.anularVenta(v.id, motivo))) {
      setAnulando(null);
      setHecho(`Venta de las ${hora(v.en)} anulada. El inventario volvió.`);
    }
  }

  return (
    <div class="ventas-hoy">
      {hecho && (
        <p class="ventas-hoy__hecho" role="status">
          {hecho}
        </p>
      )}
      <Tabla titulo="Ventas de la caja abierta" columnas={columnas} filas={ventas} claveFila={(v) => v.id} />
      {anulando && (
        <Dialogo
          titulo="¿Anular esta venta?"
          peligro
          etiquetaConfirmar="Anular venta"
          alCerrar={() => setAnulando(null)}
          alConfirmar={() => void anular()}
        >
          <p>
            Venta de las {hora(anulando.en)} por {pesos(anulando.total)}. Queda a la vista como anulada y los productos
            vuelven al inventario.
          </p>
          <CampoTexto etiqueta="Motivo" valor={motivo} alCambiar={setMotivo} marcador="Ej.: se cobró dos veces" error={error} />
        </Dialogo>
      )}
    </div>
  );
}
