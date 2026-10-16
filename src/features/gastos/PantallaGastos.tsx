import { useState } from 'preact/hooks';
import { diaDe as diaDeEvento, FORMAS_EGRESO, leerDinero, pesos, sumar, type Centavos, type FormaEgreso, type Gasto } from '../../core/negocio';
import { diaDe } from '../../core/notas/fechas';
import { useEstado } from '../../app/estado';
import { Boton } from '../../ui/Boton';
import { BotonFlotante } from '../../ui/BotonFlotante';
import { CampoNumero } from '../../ui/CampoNumero';
import { CampoTexto } from '../../ui/CampoTexto';
import { Casilla } from '../../ui/Casilla';
import { categoriaDe } from '../../ui/categorias';
import { Chip, ChipFiltro, GrupoChips } from '../../ui/Chip';
import { Cifra } from '../../ui/Cifra';
import { Conmutador } from '../../ui/Conmutador';
import { Dialogo } from '../../ui/Dialogo';
import { Disposicion, Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Hoja } from '../../ui/Hoja';
import { Insignia } from '../../ui/Insignia';
import { Interruptor } from '../../ui/Interruptor';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { useNegocio } from '../negocio/contexto';
import { SelectorAdjunto, useGuardarAdjuntos, VisorAdjunto, type ArchivoPendiente } from '../adjuntos/componentes';
import { fechaCorta, fechaHora, mensajeDe, nombreUsuario } from '../inventario/comun';
import { Aviso } from '../inventario/formularios';
import { NOMBRE_FORMA_CORTO } from '../compras/FichaFactura';
import '../inventario/inventario.css';

export const CATEGORIAS_GASTO = ['Arriendo', 'Servicios', 'Nómina', 'Aseo', 'Domicilios', 'Mantenimiento', 'Insumos', 'Otros'] as const;

export type Periodo = 'hoy' | 'semana' | 'mes' | 'todo';
const PERIODOS: readonly { valor: Periodo; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: '7 días' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'todo', etiqueta: 'Todo' },
];

/** Primer día (incluido) del período, o null para «todo». */
export function desdePeriodo(p: Periodo, ahora = new Date()): string | null {
  if (p === 'todo') return null;
  if (p === 'hoy') return diaDe(ahora);
  if (p === 'mes') return diaDe(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
  return diaDe(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 6));
}

/**
 * Gastos (`#/gastos`). El dueño ve y registra todos; el cajero solo los pagados desde la caja
 * abierta (los suyos y los de su turno). Anular es del dueño.
 */
export function PantallaGastos() {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [soloCaja, setSoloCaja] = useState(false);
  const [anulados, setAnulados] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [soporte, setSoporte] = useState<Gasto | null>(null);
  const [anular, setAnular] = useState<Gasto | null>(null);
  const [motivo, setMotivo] = useState('');
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [error, setError] = useState('');

  const todos = negocio.puede('gasto.registrar');
  const deCaja = negocio.puede('gasto.registrarDeCaja');
  if (!todos && !deCaja) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Gastos" />
        <EstadoVacio mensaje="Tu cargo no maneja gastos." pista="Los registran el dueño y el cajero (los pagados desde la caja)." />
      </Pagina>
    );
  }

  const desde = desdePeriodo(periodo);
  const visiblesBase = Object.values(estado.gastos).filter((g) => (todos ? true : g.deCaja && g.cajaId !== null && g.cajaId === estado.caja?.id));
  const enPeriodo = visiblesBase.filter((g) => (desde === null || diaDeEvento(g) >= desde) && (anulados || !g.anulado));
  const lista = enPeriodo
    .filter((g) => (categorias.length === 0 || categorias.includes(g.categoria)) && (!soloCaja || g.deCaja))
    .sort((a, b) => b.en.localeCompare(a.en));
  const total = sumar(lista.filter((g) => !g.anulado).map((g) => g.monto));
  const conteo = new Map<string, number>();
  for (const g of enPeriodo) conteo.set(g.categoria, (conteo.get(g.categoria) ?? 0) + 1);
  const nombresCategoria = [...new Set([...CATEGORIAS_GASTO, ...conteo.keys()])];
  const activos = categorias.length + (soloCaja ? 1 : 0) + (anulados ? 1 : 0);

  // Agrupados por día, del más reciente al más viejo
  const dias = new Map<string, Gasto[]>();
  for (const g of lista) {
    const d = diaDeEvento(g);
    dias.set(d, [...(dias.get(d) ?? []), g]);
  }

  async function confirmarAnular() {
    if (!anular) return;
    if (!motivo.trim()) return setFaltaMotivo(true);
    setError('');
    try {
      await negocio.anularGasto(anular.id, motivo);
      avisar('Gasto anulado.');
    } catch (e) {
      setError(mensajeDe(e));
    }
    setAnular(null);
    setMotivo('');
  }

  const panel = (
    <>
      <fieldset class="inv-filtro">
        <legend class="inv-filtro__titulo">Categorías</legend>
        <div class="inv-filtro__lista">
          {nombresCategoria.map((c) => (
            <Casilla
              key={c}
              etiqueta={c}
              contador={conteo.get(c) ?? 0}
              marcada={categorias.includes(c)}
              alCambiar={(si) => setCategorias((l) => (si ? [...l, c] : l.filter((x) => x !== c)))}
            />
          ))}
        </div>
      </fieldset>
      {todos && <Conmutador etiqueta="Solo pagados desde la caja" activo={soloCaja} alCambiar={setSoloCaja} />}
      <Conmutador etiqueta="Ver anulados" activo={anulados} alCambiar={setAnulados} />
    </>
  );

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Gastos" />
      <Disposicion
        activos={activos}
        panel={panel}
        barra={<Segmentado etiqueta="Período" opciones={PERIODOS} valor={periodo} alCambiar={setPeriodo} />}
      >
        <Rejilla tipo="cifra" etiqueta="Total de gastos">
          <Cifra
            etiqueta={`Total (${PERIODOS.find((p) => p.valor === periodo)?.etiqueta.toLowerCase()})`}
            icono="gasto"
            valor={pesos(total)}
            color="coral"
            detalle={`${lista.filter((g) => !g.anulado).length} gastos`}
          />
        </Rejilla>
        {activos > 0 && (
          <div class="inv-activos">
            <p class="inv-activos__titulo">Filtros activos</p>
            <GrupoChips etiqueta="Filtros activos">
              {categorias.map((c) => (
                <ChipFiltro key={c} alQuitar={() => setCategorias((l) => l.filter((x) => x !== c))}>
                  {c}
                </ChipFiltro>
              ))}
              {soloCaja && <ChipFiltro alQuitar={() => setSoloCaja(false)}>Desde la caja</ChipFiltro>}
              {anulados && <ChipFiltro alQuitar={() => setAnulados(false)}>Con anulados</ChipFiltro>}
              <Boton
                variante="texto"
                alTocar={() => {
                  setCategorias([]);
                  setSoloCaja(false);
                  setAnulados(false);
                }}
              >
                Limpiar todo
              </Boton>
            </GrupoChips>
          </div>
        )}
        <Aviso texto={error} />
        {lista.length === 0 ? (
          <EstadoVacio
            mensaje={visiblesBase.length === 0 ? 'Aún no hay gastos.' : 'Ningún gasto en este período.'}
            pista="Anótalos apenas pasen con «Nuevo gasto»: hielo, domicilios, aseo, servicios…"
          />
        ) : (
          [...dias].map(([dia, gastos]) => (
            <section key={dia} aria-label={fechaCorta(dia)}>
              <h2 class="inv-dia">{fechaCorta(dia)}</h2>
              <ul class="inv-lista">
                {gastos.map((g) => (
                  <li key={g.id} class={`inv-fila${g.anulado ? ' inv-fila--anulada' : ''}`}>
                    <Insignia tono={categoriaDe(g.categoria)}>{g.categoria}</Insignia>
                    <span class="inv-fila__texto">
                      <span class="inv-fila__titulo">{g.descripcion || g.categoria}</span>
                      <span class="inv-fila__detalle">
                        {NOMBRE_FORMA_CORTO[g.forma]}
                        {g.deCaja ? ' · de la caja' : ''} · {fechaHora(g.en)} · {nombreUsuario(estado, g.por)}
                        {g.anulado ? ' · anulado' : ''}
                      </span>
                    </span>
                    <span class="inv-fila__monto cifras">{pesos(g.monto)}</span>
                    <span class="inv-fila__acciones">
                      {g.adjunto && (
                        <Boton variante="texto" icono="adjunto" etiqueta={`Ver soporte de ${g.descripcion || g.categoria}`} alTocar={() => setSoporte(g)}>
                          Soporte
                        </Boton>
                      )}
                      {!g.anulado && negocio.puede('gasto.anular') && (
                        <Boton variante="texto" icono="papelera" etiqueta={`Anular ${g.descripcion || g.categoria}`} alTocar={() => setAnular(g)}>
                          Anular
                        </Boton>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Disposicion>

      <div class="inv-espacio-flotante" aria-hidden="true" />
      <BotonFlotante etiqueta="Nuevo gasto" extendido alTocar={() => setNuevo(true)} />
      {nuevo && <HojaGasto soloCaja={!todos} alCerrar={() => setNuevo(false)} />}
      {soporte?.adjunto && (
        <Hoja titulo={`Soporte: ${soporte.descripcion || soporte.categoria}`} alCerrar={() => setSoporte(null)}>
          <VisorAdjunto id={soporte.adjunto} titulo="Soporte del gasto" />
        </Hoja>
      )}
      {anular && (
        <Dialogo
          titulo="¿Anular este gasto?"
          etiquetaConfirmar="Anular"
          peligro
          alCerrar={() => {
            setAnular(null);
            setFaltaMotivo(false);
          }}
          alConfirmar={() => void confirmarAnular()}
        >
          <p>
            {anular.descripcion || anular.categoria}: <strong class="cifras">{pesos(anular.monto)}</strong>. Queda a la vista como anulado.
          </p>
          <CampoTexto
            etiqueta="Motivo"
            valor={motivo}
            alCambiar={(v) => {
              setMotivo(v);
              setFaltaMotivo(false);
            }}
            error={faltaMotivo ? 'Escribe el motivo para anular.' : undefined}
          />
        </Dialogo>
      )}
    </Pagina>
  );
}

/** Nuevo gasto. `soloCaja`: el cajero solo registra gastos pagados en efectivo desde la caja. */
function HojaGasto({ soloCaja, alCerrar }: { soloCaja: boolean; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const guardarAdjuntos = useGuardarAdjuntos();
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<string>('');
  const [descripcion, setDescripcion] = useState('');
  const [forma, setForma] = useState<FormaEgreso>('efectivo');
  const hayCaja = estado.caja !== null;
  const [deCaja, setDeCaja] = useState(soloCaja || hayCaja);
  const [adjuntos, setAdjuntos] = useState<ArchivoPendiente[]>([]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const desdeCaja = (soloCaja || deCaja) && forma === 'efectivo' && hayCaja;

  async function guardar() {
    setError('');
    let monto: Centavos;
    try {
      monto = leerDinero(valor);
    } catch (e) {
      return setError(mensajeDe(e));
    }
    if (monto === 0) return setError('Escribe un valor mayor que cero.');
    if (!categoria) return setError('Elige la categoría.');
    if (soloCaja && !hayCaja) return setError('No hay caja abierta. Abre la caja antes de pagar un gasto con ella.');
    setOcupado(true);
    let deshacer: () => Promise<void> = () => Promise.resolve();
    try {
      const g = await guardarAdjuntos(adjuntos);
      deshacer = g.deshacer;
      await negocio.registrarGasto({ categoria, descripcion: descripcion.trim() || categoria, monto, forma: desdeCaja ? 'efectivo' : forma, deCaja: desdeCaja, adjunto: g.ids[0] ?? null });
      avisar(`Gasto de ${pesos(monto)} registrado.`);
      alCerrar();
    } catch (e) {
      await deshacer();
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Hoja
      titulo="Nuevo gasto"
      alCerrar={alCerrar}
      pie={
        <div class="inv-pie">
          <Boton variante="texto" alTocar={alCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" desactivado={ocupado} alTocar={() => void guardar()}>
            Registrar gasto
          </Boton>
        </div>
      }
    >
      <div class="inv-form">
        <CampoNumero etiqueta="Valor" prefijo="$" valor={valor} alCambiar={setValor} marcador="0" grande />
        <fieldset class="inv-filtro">
          <legend class="inv-form__etiqueta">Categoría</legend>
          <GrupoChips etiqueta="Categoría del gasto">
            {CATEGORIAS_GASTO.map((c) => (
              <Chip key={c} seleccionado={categoria === c} alCambiar={() => setCategoria(c)}>
                {c}
              </Chip>
            ))}
          </GrupoChips>
        </fieldset>
        <CampoTexto etiqueta="Descripción" valor={descripcion} alCambiar={setDescripcion} marcador="Ej.: hielo para la noche" />
        {!soloCaja && (
          <Segmentado
            etiqueta="Forma de pago"
            opciones={FORMAS_EGRESO.map((f) => ({ valor: f, etiqueta: NOMBRE_FORMA_CORTO[f] }))}
            valor={forma}
            alCambiar={setForma}
          />
        )}
        <Interruptor
          etiqueta="Pagado desde la caja"
          descripcion={
            !hayCaja
              ? 'No hay caja abierta.'
              : soloCaja
                ? 'Tu cargo solo registra gastos pagados con efectivo de la caja.'
                : forma !== 'efectivo'
                  ? 'Solo el efectivo sale del cajón.'
                  : 'Se descuenta del efectivo esperado al cerrar.'
          }
          activo={desdeCaja}
          desactivado={soloCaja || !hayCaja || forma !== 'efectivo'}
          alCambiar={setDeCaja}
        />
        <SelectorAdjunto archivos={adjuntos} alCambiar={setAdjuntos} maximo={1} etiqueta="Foto del soporte (opcional)" />
        <Aviso texto={error} />
      </div>
    </Hoja>
  );
}
