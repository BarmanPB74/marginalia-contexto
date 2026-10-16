import { useEffect, useState } from 'preact/hooks';
import {
  diaDe,
  FORMAS_EGRESO,
  importe,
  leerDinero,
  mostrarCantidad,
  pesos,
  pesosPlano,
  type Centavos,
  type Compra,
  type EventoDe,
  type FormaEgreso,
  type LineaCompra,
} from '../../core/negocio';
import { useEstado } from '../../app/estado';
import { Boton } from '../../ui/Boton';
import { CampoNumero } from '../../ui/CampoNumero';
import { CampoTexto } from '../../ui/CampoTexto';
import { Cifra } from '../../ui/Cifra';
import { Dialogo } from '../../ui/Dialogo';
import { Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Hoja } from '../../ui/Hoja';
import { Insignia } from '../../ui/Insignia';
import { Interruptor } from '../../ui/Interruptor';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { Tabla } from '../../ui/Tabla';
import { useNegocio } from '../negocio/contexto';
import { VisorAdjunto } from '../adjuntos/componentes';
import { ABREV_UNIDAD, fechaCorta, fechaHora, hoy, ir, mensajeDe, nombreUsuario } from '../inventario/comun';
import { Aviso } from '../inventario/formularios';
import { marcasDe, NOMBRE_MARCA, TONO_MARCA } from './marcas';
import '../inventario/inventario.css';

export const NOMBRE_FORMA_CORTO: Readonly<Record<FormaEgreso, string>> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

type Abierta = 'aplicar' | 'pagar' | 'anular' | null;

/** Ficha de una factura (`#/compras?factura=<id>`): renglones, soporte, aplicar, pagos y saldo. */
export function FichaFactura({ id }: { id: string }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const compra = estado.compras[id];
  const [abierta, setAbierta] = useState<Abierta>(null);
  const [error, setError] = useState('');
  const [motivo, setMotivo] = useState('');
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [pagos, setPagos] = useState<EventoDe<'pago.factura'>[] | null>(null);
  const verPagos = negocio.puede('contabilidad.ver');

  // Los pagos uno a uno salen del diario (solo quien ve la contabilidad); el saldo, del estado
  useEffect(() => {
    if (!compra || !verPagos) return;
    let vigente = true;
    negocio.eventos({ desde: diaDe({ en: compra.registradaEn }) }).then(
      (ev) => vigente && setPagos(ev.filter((e): e is EventoDe<'pago.factura'> => e.tipo === 'pago.factura' && e.datos.compraId === id)),
      () => vigente && setPagos([]),
    );
    return () => {
      vigente = false;
    };
  }, [negocio, id, estado.eventos, verPagos]);

  const volver = () => ir('#/compras');
  if (!compra || !negocio.puede('compra.ver')) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Factura" accion={{ etiqueta: 'Volver', alTocar: volver }} />
        <EstadoVacio mensaje="No se encontró esa factura." pista="Vuelve a la lista de compras." />
      </Pagina>
    );
  }
  const c: Compra = compra;
  const marcas = marcasDe(c, hoy());

  async function hacer(fn: () => Promise<unknown>, aviso: string) {
    setError('');
    try {
      await fn();
      avisar(aviso);
      setAbierta(null);
    } catch (e) {
      setAbierta(null);
      setError(mensajeDe(e));
    }
  }

  const unidad = (l: LineaCompra) => {
    const p = estado.productos[l.productoId];
    return p ? ABREV_UNIDAD[p.unidad] : '';
  };

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo={`Factura ${c.numero}`} accion={{ etiqueta: 'Volver', alTocar: volver }} />
      <div class="inv-ficha">
        <p class="inv-ficha__estado">
          <span>{c.proveedor}</span>
          {marcas.map((m) => (
            <Insignia key={m} tono={TONO_MARCA[m]}>
              {NOMBRE_MARCA[m]}
            </Insignia>
          ))}
        </p>

        <Rejilla tipo="cifra" etiqueta="Cifras de la factura">
          <Cifra etiqueta="Total" icono="factura" valor={pesos(c.total)} color="indigo" />
          <Cifra etiqueta="Pagado" icono="check" valor={pesos(c.pagado)} color="esmeralda" />
          <Cifra etiqueta="Saldo" icono="gasto" valor={pesos(c.saldo)} color={c.saldo > 0 ? 'coral' : 'cielo'} />
        </Rejilla>

        <dl class="inv-datos">
          <div>
            <dt>Fecha</dt>
            <dd>{fechaCorta(c.fecha)}</dd>
          </div>
          <div>
            <dt>Vence</dt>
            <dd>{c.vence ? fechaCorta(c.vence) : 'Sin vencimiento'}</dd>
          </div>
          <div>
            <dt>Registrada</dt>
            <dd>
              {fechaHora(c.registradaEn)} · {nombreUsuario(estado, c.por)}
            </dd>
          </div>
          <div>
            <dt>Inventario</dt>
            <dd>{c.aplicadaEn ? `Aplicada el ${fechaHora(c.aplicadaEn)}` : c.estado === 'anulada' ? 'Anulada' : 'Aún no se aplica'}</dd>
          </div>
          {c.nota && (
            <div>
              <dt>Nota</dt>
              <dd>{c.nota}</dd>
            </div>
          )}
        </dl>

        <div class="inv-acciones" role="group" aria-label="Acciones de la factura">
          {c.estado === 'registrada' && negocio.puede('compra.aplicar') && (
            <Boton variante="primario" icono="inventario" alTocar={() => setAbierta('aplicar')}>
              Aplicar al inventario
            </Boton>
          )}
          {c.estado !== 'anulada' && c.saldo > 0 && negocio.puede('pago.factura') && (
            <Boton icono="gasto" alTocar={() => setAbierta('pagar')}>
              Pagar
            </Boton>
          )}
          {c.estado === 'registrada' && c.pagado === 0 && negocio.puede('compra.anular') && (
            <Boton variante="texto" icono="papelera" alTocar={() => setAbierta('anular')}>
              Anular
            </Boton>
          )}
        </div>
        <Aviso texto={error} />

        <section class="inv-seccion" aria-labelledby="ff-renglones">
          <h2 class="inv-seccion__titulo" id="ff-renglones">
            Productos
          </h2>
          <Tabla
            titulo={`Productos de la factura ${c.numero}`}
            columnas={[
              { clave: 'p', titulo: 'Producto', principal: true, celda: (l: LineaCompra) => estado.productos[l.productoId]?.nombre ?? '—' },
              { clave: 'q', titulo: 'Cantidad', numerica: true, celda: (l: LineaCompra) => `${mostrarCantidad(l.cantidad)} ${unidad(l)}` },
              { clave: 'c', titulo: 'Costo unitario', numerica: true, celda: (l: LineaCompra) => pesos(l.costoUnit) },
              {
                clave: 'i',
                titulo: 'Importe',
                numerica: true,
                celda: (l: LineaCompra) => pesos(importe(l.cantidad, l.costoUnit)),
              },
            ]}
            filas={c.lineas}
            claveFila={(l) => l.productoId}
          />
        </section>

        <section class="inv-seccion" aria-labelledby="ff-soporte">
          <h2 class="inv-seccion__titulo" id="ff-soporte">
            Soporte
          </h2>
          {c.adjuntos.length === 0 ? (
            <p class="inv-suave">Sin foto ni PDF.</p>
          ) : (
            c.adjuntos.map((a, i) => <VisorAdjunto key={a} id={a} titulo={`Soporte ${i + 1} de la factura ${c.numero}`} />)
          )}
        </section>

        {verPagos && (
          <section class="inv-seccion" aria-labelledby="ff-pagos">
            <h2 class="inv-seccion__titulo" id="ff-pagos">
              Pagos
            </h2>
            <Tabla
              titulo={`Pagos de la factura ${c.numero}`}
              columnas={[
                { clave: 'en', titulo: 'Fecha', principal: true, celda: (e: EventoDe<'pago.factura'>) => fechaHora(e.en) },
                { clave: 'forma', titulo: 'Forma', celda: (e: EventoDe<'pago.factura'>) => NOMBRE_FORMA_CORTO[e.datos.forma] + (e.datos.deCaja ? ' · de la caja' : '') },
                { clave: 'por', titulo: 'Quién', celda: (e: EventoDe<'pago.factura'>) => nombreUsuario(estado, e.por) },
                { clave: 'monto', titulo: 'Valor', numerica: true, celda: (e: EventoDe<'pago.factura'>) => pesos(e.datos.monto) },
              ]}
              filas={pagos ?? []}
              claveFila={(e) => e.id}
              vacia={pagos === null ? 'Cargando…' : 'Sin pagos todavía.'}
            />
          </section>
        )}
      </div>

      {abierta === 'aplicar' && (
        <Dialogo
          titulo="¿Aplicar al inventario?"
          etiquetaConfirmar="Aplicar"
          alCerrar={() => setAbierta(null)}
          alConfirmar={() => void hacer(() => negocio.aplicarCompra(c.id), `Factura ${c.numero} aplicada: las existencias subieron.`)}
        >
          <p>
            Suma las cantidades de {c.lineas.length === 1 ? 'su producto' : `sus ${c.lineas.length} productos`} a las existencias y
            deja su costo como el último. Se hace una sola vez.
          </p>
        </Dialogo>
      )}
      {abierta === 'anular' && (
        <Dialogo
          titulo={`¿Anular la factura ${c.numero}?`}
          etiquetaConfirmar="Anular"
          peligro
          alCerrar={() => setAbierta(null)}
          alConfirmar={() => {
            if (!motivo.trim()) return setFaltaMotivo(true);
            void hacer(() => negocio.anularCompra(c.id, motivo), `Factura ${c.numero} anulada.`);
          }}
        >
          <p>Queda a la vista como anulada. No se puede deshacer.</p>
          <CampoTexto
            etiqueta="Motivo"
            valor={motivo}
            alCambiar={(v) => {
              setMotivo(v);
              setFaltaMotivo(false);
            }}
            marcador="Ej.: el proveedor la cambió"
            error={faltaMotivo ? 'Escribe el motivo para anular.' : undefined}
          />
        </Dialogo>
      )}
      {abierta === 'pagar' && <HojaPago compra={c} alCerrar={() => setAbierta(null)} />}
    </Pagina>
  );
}

/** Pagar una factura: parcial o total, con la forma de pago y si sale del cajón. */
function HojaPago({ compra, alCerrar }: { compra: Compra; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const [monto, setMonto] = useState(pesosPlano(compra.saldo));
  const [forma, setForma] = useState<FormaEgreso>('efectivo');
  const [deCaja, setDeCaja] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const hayCaja = estado.caja !== null;

  async function pagar() {
    setError('');
    let valor: Centavos;
    try {
      valor = leerDinero(monto);
    } catch (e) {
      return setError(mensajeDe(e));
    }
    if (valor === 0) return setError('Escribe un valor mayor que cero.');
    setOcupado(true);
    try {
      await negocio.pagarFactura({ compraId: compra.id, monto: valor, forma, deCaja: deCaja && forma === 'efectivo' });
      avisar(`Pago de ${pesos(valor)} registrado.`);
      alCerrar();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Hoja
      titulo={`Pagar factura ${compra.numero}`}
      alCerrar={alCerrar}
      pie={
        <div class="inv-pie">
          <Boton variante="texto" alTocar={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" desactivado={ocupado} alTocar={() => void pagar()}>
            Registrar pago
          </Boton>
        </div>
      }
    >
      <div class="inv-form">
        <p class="inv-form__dato">
          Saldo: <strong class="cifras">{pesos(compra.saldo)}</strong>
        </p>
        <CampoNumero etiqueta="Valor del pago" prefijo="$" valor={monto} alCambiar={setMonto} grande ayuda="Puedes pagar una parte." />
        <Segmentado
          etiqueta="Forma de pago"
          opciones={FORMAS_EGRESO.map((f) => ({ valor: f, etiqueta: NOMBRE_FORMA_CORTO[f] }))}
          valor={forma}
          alCambiar={setForma}
        />
        <Interruptor
          etiqueta="Pagado desde la caja"
          descripcion={!hayCaja ? 'No hay caja abierta.' : forma !== 'efectivo' ? 'Solo el efectivo sale del cajón.' : 'Se descuenta del efectivo esperado al cerrar.'}
          activo={deCaja && forma === 'efectivo' && hayCaja}
          desactivado={!hayCaja || forma !== 'efectivo'}
          alCambiar={setDeCaja}
        />
        <Aviso texto={error} />
      </div>
    </Hoja>
  );
}
