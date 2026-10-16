import { useEffect, useState } from 'preact/hooks';
import { diaDe, leerDinero, pesos, vendidoCaja, type CajaCerrada, type Centavos, type Evento } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Cifra } from '../../ui/Cifra';
import { Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Hoja } from '../../ui/Hoja';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { Tabla, type Columna } from '../../ui/Tabla';
import { Tarjeta } from '../../ui/Tarjeta';
import { useNegocio } from '../negocio/contexto';
import { AbrirCaja } from './AbrirCaja';
import { CerrarCaja, Diferencia, textoDiferencia } from './CerrarCaja';
import { EntradaDinero, fechaHora, hora, textoError, useOperacion } from './comun';
import './PantallaCaja.css';

/** `#/caja/cerrar` abre directamente el cierre (lo usa «Cerrar caja» de Inicio). */
const pideCerrar = () => /^#\/caja\/cerrar\b/.test(location.hash);

/**
 * Caja (NEGOCIO §4.1, 4.3 y 4.4): abrir con la base, entradas y retiros con motivo, movimientos
 * de la caja abierta, cierre en pasos e historial de cajas cerradas.
 */
export function PantallaCaja() {
  const { negocio, estado } = useNegocio();
  const [cerrando, setCerrando] = useState(pideCerrar);
  const [movimiento, setMovimiento] = useState<'ingreso' | 'retiro' | null>(null);
  const [hecho, setHecho] = useState('');
  const caja = estado.caja;
  const puedeAlgo = negocio.puede('caja.abrir') || negocio.puede('caja.cerrar') || negocio.puede('caja.movimiento');

  if (!puedeAlgo) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Caja" />
        <EstadoVacio mensaje="Tu cargo no maneja la caja." pista="La caja la abren y cierran el dueño y los cajeros." />
      </Pagina>
    );
  }

  const terminarCierre = () => {
    setCerrando(false);
    if (pideCerrar()) history.replaceState(null, '', '#/caja');
  };

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Caja" />
      <div class="caja">
        {hecho && (
          <p class="mensaje-hecho" role="status">
            {hecho}
          </p>
        )}
        {!caja ? (
          <Tarjeta>
            <h2 class="caja__titulo">La caja está cerrada</h2>
            {negocio.puede('caja.abrir') ? (
              <>
                <p class="caja__texto">Para vender, abre la caja con la base: el efectivo con que empiezas.</p>
                <AbrirCaja alAbrir={() => setHecho('Caja abierta. Ya puedes vender.')} />
              </>
            ) : (
              <p class="caja__texto">Tu cargo no permite abrir la caja.</p>
            )}
          </Tarjeta>
        ) : cerrando ? (
          <Tarjeta>
            <h2 class="caja__titulo">Cerrar caja</h2>
            <CerrarCaja
              alCancelar={terminarCierre}
              alCerrar={() => {
                terminarCierre();
                setHecho('Caja cerrada. El cierre quedó guardado en el historial.');
              }}
            />
          </Tarjeta>
        ) : (
          <CajaAbierta
            alMover={(tipo) => {
              setHecho('');
              setMovimiento(tipo);
            }}
            alCerrar={() => {
              setHecho('');
              setCerrando(true);
            }}
          />
        )}

        {caja && !cerrando && <Movimientos />}
        <Historial cierres={estado.cierres} />
      </div>
      {movimiento && caja && (
        <NuevoMovimiento
          tipoInicial={movimiento}
          alCerrar={() => setMovimiento(null)}
          alGuardar={(texto) => {
            setMovimiento(null);
            setHecho(texto);
          }}
        />
      )}
    </Pagina>
  );
}

function CajaAbierta({ alMover, alCerrar }: { alMover: (t: 'ingreso' | 'retiro') => void; alCerrar: () => void }) {
  const { negocio } = useNegocio();
  const r = negocio.resumenCierre();
  if (!r) return null;
  return (
    <section class="caja__abierta" aria-label="Caja abierta">
      <p class="caja__texto">
        Abierta por {r.abiertaPor} · <span class="cifras">{fechaHora(r.abiertaEn)}</span>
      </p>
      <Rejilla tipo="cifra" etiqueta="Cifras de la caja">
        <Cifra etiqueta="Efectivo esperado" valor={pesos(r.esperado)} icono="caja" color="esmeralda" detalle="en el cajón" />
        <Cifra etiqueta="Base" valor={pesos(r.base)} color="cielo" />
        <Cifra etiqueta={`Vendido (${r.ventas})`} valor={pesos(r.vendido)} icono="vender" color="indigo" />
        <Cifra etiqueta="Entradas" valor={pesos(r.ingresos)} icono="sube" color="turquesa" />
        <Cifra etiqueta="Retiros" valor={pesos(r.retiros)} icono="baja" color="coral" />
        {r.gastos > 0 && <Cifra etiqueta="Gastos desde la caja" valor={pesos(r.gastos)} icono="gasto" color="ambar" />}
        {r.pagos > 0 && <Cifra etiqueta="Pagos desde la caja" valor={pesos(r.pagos)} icono="factura" color="fucsia" />}
      </Rejilla>
      <div class="caja__acciones">
        {negocio.puede('caja.movimiento') && (
          <>
            <Boton icono="sube" alTocar={() => alMover('ingreso')}>
              Entrada de efectivo
            </Boton>
            <Boton icono="baja" alTocar={() => alMover('retiro')}>
              Retiro de efectivo
            </Boton>
          </>
        )}
        {negocio.puede('caja.cerrar') && (
          <Boton variante="primario" icono="candado" alTocar={alCerrar}>
            Cerrar caja
          </Boton>
        )}
      </div>
    </section>
  );
}

function NuevoMovimiento({
  tipoInicial,
  alCerrar,
  alGuardar,
}: {
  tipoInicial: 'ingreso' | 'retiro';
  alCerrar: () => void;
  alGuardar: (texto: string) => void;
}) {
  const { negocio } = useNegocio();
  const [tipo, setTipo] = useState(tipoInicial);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | undefined>();
  const { error, setError, ocupado, correr } = useOperacion();

  async function guardar() {
    let valor: Centavos;
    try {
      valor = leerDinero(monto);
    } catch (e) {
      setError(textoError(e));
      return;
    }
    if (valor <= 0) return setError('Escribe un valor mayor que cero.');
    if (!motivo.trim()) return setErrorMotivo('Escribe el motivo (p. ej. «sencillo para el cambio»).');
    if (await correr(() => negocio.movimientoCaja({ tipo, monto: valor, motivo }))) {
      alGuardar(`${tipo === 'ingreso' ? 'Entrada' : 'Retiro'} de ${pesos(valor)} guardado.`);
    }
  }

  return (
    <Hoja
      titulo={tipo === 'ingreso' ? 'Entrada de efectivo' : 'Retiro de efectivo'}
      alCerrar={alCerrar}
      pie={
        <Boton variante="primario" ancho icono="check" desactivado={ocupado} alTocar={() => void guardar()}>
          {ocupado ? 'Guardando…' : 'Guardar'}
        </Boton>
      }
    >
      <div class="caja__formulario">
        <Segmentado
          etiqueta="Tipo de movimiento"
          opciones={[
            { valor: 'ingreso', etiqueta: 'Entrada' },
            { valor: 'retiro', etiqueta: 'Retiro' },
          ]}
          valor={tipo}
          alCambiar={setTipo}
        />
        <CampoTexto
          etiqueta="Motivo"
          valor={motivo}
          alCambiar={(v) => {
            setMotivo(v);
            setErrorMotivo(undefined);
          }}
          marcador={tipo === 'ingreso' ? 'Ej.: sencillo para el cambio' : 'Ej.: consignación en el banco'}
          error={errorMotivo}
        />
        <EntradaDinero
          etiqueta="Valor"
          valor={monto}
          alCambiar={(v) => {
            setMonto(v);
            setError(undefined);
          }}
          error={error}
        />
      </div>
    </Hoja>
  );
}

interface FilaMovimiento {
  id: string;
  en: string;
  que: string;
  detalle: string;
  /** Con signo: + entra al cajón, − sale */
  valor: string;
}

/**
 * Movimientos de plata de la caja abierta. El estado sólo guarda totales; el detalle se lee del
 * diario, y el núcleo sólo deja leerlo a quien ve la contabilidad (el dueño).
 */
function Movimientos() {
  const { negocio, estado } = useNegocio();
  const caja = estado.caja;
  const puedeVer = negocio.puede('contabilidad.ver');
  const [filas, setFilas] = useState<FilaMovimiento[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!caja || !puedeVer) return;
    let vigente = true;
    negocio.eventos({ desde: diaDe({ en: caja.abiertaEn }) }).then(
      (eventos) => vigente && setFilas(filasDe(eventos, caja.id)),
      (e: unknown) => vigente && setError(textoError(e)),
    );
    return () => {
      vigente = false;
    };
  }, [negocio, caja?.id, estado.eventos, puedeVer]);

  if (!caja) return null;

  function filasDe(eventos: readonly Evento[], cajaId: string): FilaMovimiento[] {
    const desde = eventos.findIndex((e) => e.tipo === 'caja.abierta' && e.id === cajaId);
    const r: FilaMovimiento[] = [];
    for (const e of desde < 0 ? [] : eventos.slice(desde)) {
      if (e.tipo === 'caja.cerrada') break;
      if (e.tipo === 'caja.abierta') r.push({ id: e.id, en: e.en, que: 'Apertura', detalle: 'Base', valor: `+${pesos(e.datos.base)}` });
      else if (e.tipo === 'caja.movimiento') {
        const entra = e.datos.tipo === 'ingreso';
        r.push({ id: e.id, en: e.en, que: entra ? 'Entrada' : 'Retiro', detalle: e.datos.motivo, valor: `${entra ? '+' : '−'}${pesos(e.datos.monto)}` });
      } else if (e.tipo === 'gasto.registrado' && e.datos.deCaja) {
        r.push({ id: e.id, en: e.en, que: 'Gasto', detalle: e.datos.descripcion, valor: `−${pesos(e.datos.monto)}` });
      } else if (e.tipo === 'pago.factura' && e.datos.deCaja) {
        const c = estado.compras[e.datos.compraId];
        r.push({ id: e.id, en: e.en, que: 'Pago a proveedor', detalle: c ? `${c.proveedor} · ${c.numero}` : '', valor: `−${pesos(e.datos.monto)}` });
      }
    }
    return r.reverse();
  }

  const columnas: Columna<FilaMovimiento>[] = [
    { clave: 'que', titulo: 'Movimiento', celda: (f) => f.que, principal: true },
    { clave: 'hora', titulo: 'Hora', celda: (f) => hora(f.en) },
    { clave: 'detalle', titulo: 'Motivo', celda: (f) => f.detalle || '—' },
    { clave: 'valor', titulo: 'Valor', celda: (f) => f.valor, numerica: true },
  ];

  return (
    <section class="caja__seccion" aria-labelledby="caja-movimientos">
      <h2 id="caja-movimientos" class="caja__titulo">
        Movimientos de la caja
      </h2>
      {!puedeVer ? (
        <p class="caja__texto">
          Las cifras de arriba suman las entradas, retiros y gastos de esta caja. El detalle de cada movimiento lo ve el dueño.
        </p>
      ) : error ? (
        <p class="mensaje-error">{error}</p>
      ) : (
        <Tabla titulo="Movimientos de la caja abierta" columnas={columnas} filas={filas ?? []} claveFila={(f) => f.id} vacia={filas ? 'Sin movimientos.' : 'Cargando…'} />
      )}
    </section>
  );
}

function Historial({ cierres }: { cierres: readonly CajaCerrada[] }) {
  const { estado } = useNegocio();
  const filas = [...cierres].reverse().slice(0, 30);
  const nombre = (id: string) => estado.usuarios[id]?.nombre ?? '—';
  const columnas: Columna<CajaCerrada>[] = [
    { clave: 'cerrada', titulo: 'Cerrada', celda: (c) => fechaHora(c.cerradaEn), principal: true },
    { clave: 'abierta', titulo: 'Abierta', celda: (c) => fechaHora(c.abiertaEn) },
    { clave: 'por', titulo: 'Cerró', celda: (c) => nombre(c.cerradaPor) },
    { clave: 'vendido', titulo: 'Vendido', celda: (c) => pesos(vendidoCaja(c)), numerica: true },
    { clave: 'esperado', titulo: 'Esperado', celda: (c) => pesos(c.esperado), numerica: true },
    { clave: 'contado', titulo: 'Contado', celda: (c) => pesos(c.contado), numerica: true },
    {
      clave: 'diferencia',
      titulo: 'Diferencia',
      celda: (c) => (
        <span class="caja__dif" aria-label={textoDiferencia(c.diferencia)}>
          <Insignia tono={c.diferencia === 0 ? 'exito' : c.diferencia > 0 ? 'aviso' : 'peligro'}>
            {c.diferencia === 0 ? 'Cuadra' : c.diferencia > 0 ? 'Sobrante' : 'Faltante'}
          </Insignia>{' '}
          <span class="cifras">{pesos(c.diferencia)}</span>
        </span>
      ),
    },
    { clave: 'nota', titulo: 'Nota', celda: (c) => c.nota ?? '—' },
  ];
  const ultima = filas[0];
  return (
    <section class="caja__seccion" aria-labelledby="caja-historial">
      <h2 id="caja-historial" class="caja__titulo">
        Cajas cerradas
      </h2>
      {ultima && (
        <div class="caja__ultima">
          <p class="caja__texto">Último cierre: {fechaHora(ultima.cerradaEn)}</p>
          <Diferencia valor={ultima.diferencia} />
        </div>
      )}
      <Tabla titulo="Historial de cierres de caja" columnas={columnas} filas={filas} claveFila={(c) => c.id} vacia="Todavía no se ha cerrado ninguna caja." />
    </section>
  );
}
