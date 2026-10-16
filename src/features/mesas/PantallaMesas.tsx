import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  centavos,
  cuentaDeMesa,
  importe,
  leerCantidad,
  milesimas,
  mostrarCantidad,
  pesos,
  stockDe,
  type Centavos,
  type Cuenta,
  type EstadoNegocio,
  type Mesa,
  type Negocio,
  type Producto,
  ReglaRota,
} from '../../core/negocio';
import { mesaEnRuta } from '../../app/rutas';
import { Boton } from '../../ui/Boton';
import { Buscador } from '../../ui/Buscador';
import { CampoNumero } from '../../ui/CampoNumero';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip, GrupoChips } from '../../ui/Chip';
import { Dialogo } from '../../ui/Dialogo';
import { Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Hoja } from '../../ui/Hoja';
import { Icono } from '../../ui/Icono';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { TarjetaProducto } from '../../ui/TarjetaProducto';
import { AbrirCaja } from '../caja/AbrirCaja';
import { cantidadCon, hora, textoError, useOperacion } from '../caja/comun';
import { useNegocio } from '../negocio/contexto';
import { Cobrar } from '../vender/Cobrar';
import { existencias, sumar, vistaPrevia, PEDIDO_VACIO, type Pedido, type TipoDescuento } from '../vender/pedido';
import '../vender/PantallaVender.css';
import './PantallaMesas.css';

/**
 * Mesas (NEGOCIO §4.5, como el mapa de mesas de Bar_box): cada mesa dice si está libre, con
 * pedidos o si pidió la cuenta. Tocar una mesa abre su cuenta: se piden rondas (no tocan el
 * inventario), se quita con motivo y se cobra con el mismo cobro de Vender, que descuenta el
 * inventario y deja la mesa libre.
 */
export function PantallaMesas() {
  const { negocio } = useNegocio();
  const mesaId = mesaEnRuta(location.hash);
  if (!negocio.puede('cuenta.atender')) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Mesas" />
        <EstadoVacio mensaje="Tu cargo no atiende mesas." pista="Las mesas son de meseros, caja y el dueño." />
      </Pagina>
    );
  }
  return mesaId ? <VistaCuenta key={mesaId} mesaId={mesaId} /> : <Mapa />;
}

// --- Utilidades ---------------------------------------------------------------------

const MIN = 60_000;

/** «hace 5 min», «hace 1 h 20 min». */
function haceCuanto(en: string, ahora: number): string {
  const min = Math.max(0, Math.floor((ahora - Date.parse(en)) / MIN));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

/** Total de la cuenta con los precios vigentes (el que se cobra lo calcula el núcleo). */
function totalCuenta(estado: EstadoNegocio, c: Cuenta): Centavos {
  return centavos(c.lineas.reduce((s, l) => s + importe(l.cantidad, estado.productos[l.productoId]?.precio ?? centavos(0)), 0));
}

function articulos(estado: EstadoNegocio, c: Cuenta): number {
  return c.lineas.reduce((s, l) => s + (estado.productos[l.productoId]?.unidad === 'unidad' ? Math.round(l.cantidad / 1000) : 1), 0);
}

type EstadoMesa = 'libre' | 'abierta' | 'servida' | 'cuenta';

function estadoMesa(c: Cuenta | null): EstadoMesa {
  if (!c) return 'libre';
  if (c.precuenta) return 'cuenta';
  return c.lineas.length > 0 ? 'servida' : 'abierta';
}

const NOMBRE_ESTADO: Readonly<Record<EstadoMesa, string>> = {
  libre: 'Libre',
  abierta: 'Sentados',
  servida: 'Con pedido',
  cuenta: 'Pidió la cuenta',
};

/** Reloj que avanza cada minuto (para «hace 12 min»). */
function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

/** La ronda que se está armando sobrevive a ir y volver de la mesa (mientras la app esté abierta). */
const rondas = new WeakMap<Negocio, Map<string, Pedido>>();
function rondaGuardada(n: Negocio, mesaId: string): Pedido {
  return rondas.get(n)?.get(mesaId) ?? PEDIDO_VACIO;
}
function guardarRonda(n: Negocio, mesaId: string, p: Pedido) {
  const m = rondas.get(n) ?? new Map<string, Pedido>();
  if (p.lineas.length === 0) m.delete(mesaId);
  else m.set(mesaId, p);
  rondas.set(n, m);
}

function irA(hash: string) {
  location.hash = hash;
}

// --- Mapa de mesas -----------------------------------------------------------------

function Mapa() {
  const { negocio, estado } = useNegocio();
  const ahora = useAhora();
  const [creando, setCreando] = useState(false);
  const [abriendoCaja, setAbriendoCaja] = useState(false);
  const esDueno = negocio.puede('mesa.administrar');
  const mesas = Object.values(estado.mesas).filter((m) => m.activa);
  const zonas = useMemo(() => {
    const porZona = new Map<string, Mesa[]>();
    for (const m of mesas) porZona.set(m.zona, [...(porZona.get(m.zona) ?? []), m]);
    for (const lista of porZona.values()) lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
    return [...porZona].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [estado.mesas]);
  const abiertas = Object.values(estado.cuentas);
  const enMesas = centavos(abiertas.reduce((s, c) => s + totalCuenta(estado, c), 0));

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Mesas" {...(esDueno ? { accion: { etiqueta: 'Crear mesas', alTocar: () => setCreando(true) } } : {})} />
      {!estado.caja && (
        <div class="mesas__aviso" role="status">
          <p>No hay caja abierta: abre la caja para atender mesas.</p>
          {negocio.puede('caja.abrir') && (
            <Boton variante="primario" icono="caja" alTocar={() => setAbriendoCaja(true)}>
              Abrir caja
            </Boton>
          )}
        </div>
      )}
      {mesas.length === 0 ? (
        <EstadoVacio
          mensaje="Todavía no hay mesas."
          pista={esDueno ? 'Toca «Crear mesas» para armar el mapa (por ejemplo, Mesa 1 a Mesa 10 en el Salón).' : 'Pídele al dueño que cree las mesas.'}
        />
      ) : (
        <>
          <p class="mesas__resumen" aria-live="polite">
            <span>
              <strong class="cifras">{abiertas.length}</strong> de {mesas.length} ocupadas
            </span>
            {abiertas.length > 0 && negocio.puede('venta.registrar') && (
              <span>
                · por cobrar <strong class="cifras">{pesos(enMesas)}</strong>
              </span>
            )}
          </p>
          {zonas.map(([zona, lista]) => (
            <section key={zona} class="mesas__zona" aria-label={zona}>
              <h2 class="mesas__titulo-zona">{zona}</h2>
              <ul class="mesas__rejilla">
                {lista.map((m) => {
                  const c = cuentaDeMesa(estado, m.id);
                  const e = estadoMesa(c);
                  return (
                    <li key={m.id}>
                      <a class={`mesa mesa--${e}`} href={`#/mesas?mesa=${m.id}`} aria-label={`${m.nombre}: ${NOMBRE_ESTADO[e]}`}>
                        <span class="mesa__nombre">{m.nombre}</span>
                        <span class="mesa__estado">{NOMBRE_ESTADO[e]}</span>
                        {c && (
                          <span class="mesa__detalle">
                            {c.lineas.length > 0 && <span class="cifras">{pesos(totalCuenta(estado, c))}</span>}
                            <span>{haceCuanto(c.ultimoPedidoEn ?? c.abiertaEn, ahora)}</span>
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
      {creando && <CrearMesas alCerrar={() => setCreando(false)} zonas={zonas.map(([z]) => z)} />}
      {abriendoCaja && (
        <Hoja titulo="Abrir caja" alCerrar={() => setAbriendoCaja(false)}>
          <AbrirCaja alAbrir={() => setAbriendoCaja(false)} />
        </Hoja>
      )}
    </Pagina>
  );
}

function CrearMesas({ alCerrar, zonas }: { alCerrar: () => void; zonas: string[] }) {
  const { negocio } = useNegocio();
  const [modo, setModo] = useState<'varias' | 'una'>('varias');
  const [prefijo, setPrefijo] = useState('Mesa');
  const [desde, setDesde] = useState('1');
  const [hasta, setHasta] = useState('10');
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState(zonas[0] ?? 'Salón');
  const { error, setError, ocupado, correr } = useOperacion();

  async function crear() {
    const ok = await correr(async () => {
      if (modo === 'una') {
        if (!nombre.trim()) throw new ReglaRota('Escribe el nombre de la mesa (por ejemplo, «Barra 1»).');
        await negocio.crearMesa({ nombre, zona });
      } else {
        await negocio.crearMesas({ prefijo, desde: Number(desde), hasta: Number(hasta), zona });
      }
    });
    if (ok) alCerrar();
  }

  return (
    <Hoja
      titulo="Crear mesas"
      alCerrar={alCerrar}
      pie={
        <div class="mesas__pie">
          {error && (
            <p class="mesas__error" role="alert">
              {error}
            </p>
          )}
          <Boton variante="primario" ancho icono="check" desactivado={ocupado} alTocar={() => void crear()}>
            {modo === 'una' ? 'Crear mesa' : 'Crear mesas'}
          </Boton>
        </div>
      }
    >
      <div class="mesas__formulario">
        <Segmentado
          etiqueta="Cuántas"
          opciones={[
            { valor: 'varias', etiqueta: 'Varias numeradas' },
            { valor: 'una', etiqueta: 'Una' },
          ]}
          valor={modo}
          alCambiar={(v) => {
            setModo(v);
            setError(undefined);
          }}
        />
        {modo === 'varias' ? (
          <>
            <CampoTexto etiqueta="Nombre" valor={prefijo} alCambiar={setPrefijo} ayuda="Se numeran: Mesa 1, Mesa 2…" />
            <div class="mesas__rango">
              <CampoNumero etiqueta="Desde" valor={desde} alCambiar={setDesde} />
              <CampoNumero etiqueta="Hasta" valor={hasta} alCambiar={setHasta} />
            </div>
          </>
        ) : (
          <CampoTexto etiqueta="Nombre de la mesa" valor={nombre} alCambiar={setNombre} marcador="Barra 1" />
        )}
        <CampoTexto etiqueta="Zona" valor={zona} alCambiar={setZona} ayuda="Salón, Terraza, Barra… Agrupa el mapa." />
        {zonas.length > 0 && (
          <GrupoChips etiqueta="Zonas existentes">
            {zonas.map((z) => (
              <Chip key={z} seleccionado={zona === z} alCambiar={() => setZona(z)}>
                {z}
              </Chip>
            ))}
          </GrupoChips>
        )}
      </div>
    </Hoja>
  );
}

// --- Cuenta de una mesa ----------------------------------------------------------------

const norma = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');

const OPCIONES_DESCUENTO: ReadonlyArray<{ valor: TipoDescuento; etiqueta: string }> = [
  { valor: 'ninguno', etiqueta: 'Sin descuento' },
  { valor: 'porcentaje', etiqueta: '%' },
  { valor: 'valor', etiqueta: '$' },
];

function VistaCuenta({ mesaId }: { mesaId: string }) {
  const { negocio, estado } = useNegocio();
  const mesa = estado.mesas[mesaId];
  const cuenta = cuentaDeMesa(estado, mesaId);
  const [ronda, setRondaLocal] = useState<Pedido>(() => rondaGuardada(negocio, mesaId));
  const [nota, setNota] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [hoja, setHoja] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [descuento, setDescuento] = useState<Pick<Pedido, 'tipoDescuento' | 'textoDescuento'>>({ tipoDescuento: 'ninguno', textoDescuento: '' });
  const [hecho, setHecho] = useState('');
  const { error, setError, ocupado, correr } = useOperacion();

  const setRonda = (p: Pedido) => {
    setRondaLocal(p);
    setHecho('');
    setError(undefined);
  };
  useEffect(() => guardarRonda(negocio, mesaId, ronda), [negocio, mesaId, ronda]);

  const activos = useMemo(() => Object.values(estado.productos).filter((p) => p.activo), [estado.productos]);
  const categorias = useMemo(() => [...new Set(activos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'es')), [activos]);

  if (!mesa) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Mesa" />
        <EstadoVacio mensaje="Esa mesa no existe." pista="Vuelve al mapa de mesas." />
        <Boton icono="atras" alTocar={() => irA('#/mesas')}>
          Mesas
        </Boton>
      </Pagina>
    );
  }

  const q = norma(busqueda.trim());
  const visibles = activos
    .filter((p) => categoria === null || p.categoria === categoria)
    .filter((p) => !q || norma(p.nombre).includes(q) || (p.codigo !== undefined && norma(p.codigo) === q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const vistaRonda = vistaPrevia(ronda, estado);
  // La cuenta como «pedido» para la vista previa del cobro (con el descuento del dueño)
  const pedidoCuenta: Pedido = { lineas: cuenta?.lineas ?? [], ...descuento };
  const vistaCuenta = vistaPrevia(pedidoCuenta, estado);
  const e = estadoMesa(cuenta);
  const puedeCobrar = negocio.puede('venta.registrar');
  const sinCaja = !estado.caja;

  async function enviar() {
    const ok = await correr(async () => {
      await negocio.pedirEnMesa(
        mesaId,
        ronda.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
        { nota },
      );
    });
    if (ok) {
      setRondaLocal(PEDIDO_VACIO);
      setNota('');
      setHoja(false);
      setHecho('Pedido enviado a la cuenta.');
    }
  }

  async function operar(f: () => Promise<unknown>, mensaje: string) {
    setHecho('');
    if (await correr(f)) setHecho(mensaje);
  }

  const agregar = (p: Producto) => setRonda(sumar(ronda, p.id));

  const panel = (
    <div class="cuenta">
      {vistaRonda.lineas.length > 0 && (
        <section class="cuenta__ronda" aria-label="Ronda nueva">
          <h3 class="cuenta__subtitulo">Ronda nueva</h3>
          <ul class="cuenta__lineas">
            {vistaRonda.lineas.map(({ linea, producto }) => (
              <li key={producto.id} class="cuenta__linea">
                <span class="cuenta__nombre">{producto.nombre}</span>
                <span class="cuenta__paso" role="group" aria-label={`Cantidad de ${producto.nombre}`}>
                  <button type="button" aria-label={`Uno menos de ${producto.nombre}`} onClick={() => setRonda(sumar(ronda, producto.id, -1000))}>
                    <Icono nombre="menos" />
                  </button>
                  <span class="cifras">{mostrarCantidad(linea.cantidad)}</span>
                  <button type="button" aria-label={`Uno más de ${producto.nombre}`} onClick={() => setRonda(sumar(ronda, producto.id, 1000))}>
                    <Icono nombre="mas-signo" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <CampoTexto etiqueta="Nota para la barra o la cocina (opcional)" valor={nota} alCambiar={setNota} marcador="Sin hielo, bien asado…" />
          <Boton variante="primario" ancho icono="check" desactivado={ocupado || sinCaja} alTocar={() => void enviar()}>
            {cuenta ? 'Enviar pedido' : 'Abrir cuenta y enviar'}
          </Boton>
          <Boton variante="texto" ancho icono="papelera" alTocar={() => setRonda(PEDIDO_VACIO)}>
            Descartar ronda
          </Boton>
        </section>
      )}

      <section class="cuenta__pedido" aria-label="En la cuenta">
        <h3 class="cuenta__subtitulo">En la cuenta</h3>
        {!cuenta || cuenta.lineas.length === 0 ? (
          <p class="cuenta__vacia">{cuenta ? 'Cuenta abierta sin pedidos.' : 'Mesa libre. Toca los productos que pidan y envía el pedido.'}</p>
        ) : (
          <ul class="cuenta__lineas">
            {vistaCuenta.lineas.map(({ linea, producto, subtotal }) => (
              <li key={producto.id} class="cuenta__linea">
                <span class="cuenta__nombre">
                  <span class="cifras">{mostrarCantidad(linea.cantidad)}</span> × {producto.nombre}
                </span>
                <span class="cuenta__subtotal cifras">{pesos(subtotal)}</span>
                {negocio.puede('cuenta.quitar') && (
                  <button type="button" class="cuenta__quitar" aria-label={`Quitar ${producto.nombre}`} onClick={() => setQuitando(producto.id)}>
                    <Icono nombre="cerrar" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {cuenta && cuenta.lineas.length > 0 && (
          <>
            {puedeCobrar && negocio.puede('venta.descuento') && (
              <div class="cuenta__descuento">
                <Segmentado
                  etiqueta="Descuento"
                  opciones={OPCIONES_DESCUENTO}
                  valor={descuento.tipoDescuento}
                  alCambiar={(tipoDescuento) => setDescuento({ tipoDescuento, textoDescuento: '' })}
                />
                {descuento.tipoDescuento !== 'ninguno' && (
                  <CampoNumero
                    etiqueta={descuento.tipoDescuento === 'porcentaje' ? 'Descuento en porcentaje' : 'Descuento en pesos'}
                    valor={descuento.textoDescuento}
                    alCambiar={(textoDescuento) => setDescuento({ ...descuento, textoDescuento })}
                    prefijo={descuento.tipoDescuento === 'valor' ? '$' : undefined}
                    sufijo={descuento.tipoDescuento === 'porcentaje' ? '%' : undefined}
                    error={vistaCuenta.errorDescuento ?? undefined}
                  />
                )}
              </div>
            )}
            <dl class="cuenta__totales">
              {vistaCuenta.descuento > 0 && (
                <div class="cuenta__fila">
                  <dt>Descuento</dt>
                  <dd class="cifras">−{pesos(vistaCuenta.descuento)}</dd>
                </div>
              )}
              <div class="cuenta__fila cuenta__fila--total">
                <dt>Total</dt>
                <dd class="cifras">{pesos(vistaCuenta.total)}</dd>
              </div>
            </dl>
          </>
        )}
      </section>

      {cuenta && (
        <div class="cuenta__acciones">
          {cuenta.lineas.length > 0 && puedeCobrar && (
            <Boton
              variante="primario"
              ancho
              icono="caja"
              desactivado={vistaCuenta.errorDescuento !== null || ronda.lineas.length > 0}
              alTocar={() => {
                setHoja(false);
                setCobrando(true);
              }}
            >
              Cobrar {pesos(vistaCuenta.total)}
            </Boton>
          )}
          {cuenta.lineas.length > 0 && (
            <Boton
              variante="tonal"
              ancho
              icono="factura"
              alTocar={() =>
                void operar(
                  () => negocio.marcarPrecuenta(cuenta.id, !cuenta.precuenta),
                  cuenta.precuenta ? 'La mesa ya no espera la cuenta.' : 'Marcada: pidió la cuenta.',
                )
              }
            >
              {cuenta.precuenta ? 'Ya no pide la cuenta' : 'Pidió la cuenta'}
            </Boton>
          )}
          <Boton ancho icono="mover" alTocar={() => setMoviendo(true)}>
            Cambiar de mesa
          </Boton>
          {cuenta.lineas.length === 0 ? (
            <Boton variante="texto" ancho icono="cerrar" alTocar={() => void operar(() => negocio.liberarMesa(cuenta.id), 'Mesa libre.')}>
              Liberar mesa
            </Boton>
          ) : (
            negocio.puede('cuenta.anular') && (
              <Boton variante="texto" ancho icono="papelera" alTocar={() => setAnulando(true)}>
                Anular cuenta
              </Boton>
            )
          )}
        </div>
      )}
      {!cuenta && negocio.puede('mesa.administrar') && (
        <Boton variante="texto" ancho icono="papelera" alTocar={() => setRetirando(true)}>
          Retirar mesa del mapa
        </Boton>
      )}
      {error && (
        <p class="mesas__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );

  const totalBarra = vistaRonda.lineas.length > 0 ? vistaRonda.total : vistaCuenta.total;

  return (
    <Pagina ancho="amplio">
      <div class="cuenta__cabeza">
        <Boton variante="texto" icono="atras" alTocar={() => irA('#/mesas')}>
          Mesas
        </Boton>
      </div>
      <Encabezado titulo={mesa.nombre} />
      <p class="cuenta__estado">
        <Insignia tono={e === 'libre' ? 'exito' : e === 'cuenta' ? 'aviso' : 'primario'}>{NOMBRE_ESTADO[e]}</Insignia>
        <span>{mesa.zona}</span>
        {cuenta && <span>Abierta {hora(cuenta.abiertaEn)}</span>}
        {cuenta && cuenta.rondas > 0 && <span>{cuenta.rondas === 1 ? '1 ronda' : `${cuenta.rondas} rondas`}</span>}
        {cuenta && cuenta.lineas.length > 0 && <span>{articulos(estado, cuenta)} productos</span>}
      </p>
      {sinCaja && (
        <p class="mesas__aviso" role="status">
          No hay caja abierta: abre la caja para tomar pedidos.
        </p>
      )}
      {hecho && (
        <p class="mensaje-hecho" role="status">
          {hecho}
        </p>
      )}
      <div class={`vender cuenta-mesa${vistaRonda.lineas.length > 0 || (cuenta?.lineas.length ?? 0) > 0 ? ' vender--con-pedido' : ''}`}>
        <div class="vender__catalogo">
          <Buscador etiqueta="Buscar productos" valor={busqueda} alCambiar={setBusqueda} marcador="Buscar por nombre o código" />
          {categorias.length > 1 && (
            <GrupoChips etiqueta="Categorías">
              <Chip seleccionado={categoria === null} alCambiar={() => setCategoria(null)}>
                Todas
              </Chip>
              {categorias.map((c) => (
                <Chip key={c} seleccionado={categoria === c} alCambiar={(s) => setCategoria(s ? c : null)}>
                  {c}
                </Chip>
              ))}
            </GrupoChips>
          )}
          {activos.length === 0 ? (
            <EstadoVacio mensaje="No hay productos." pista="El dueño los crea o importa en Inventario." />
          ) : visibles.length === 0 ? (
            <EstadoVacio mensaje="Ningún producto coincide." pista="Prueba con otra palabra o quita el filtro." />
          ) : (
            <Rejilla etiqueta="Productos">
              {visibles.map((p) => {
                const est = existencias(estado, p);
                const enRonda = ronda.lineas.find((l) => l.productoId === p.id);
                return (
                  <TarjetaProducto
                    key={p.id}
                    nombre={p.nombre}
                    precio={pesos(p.precio)}
                    existencias={negocio.puede('inventario.ver') ? cantidadCon(stockDe(estado, p.id), p.unidad) : undefined}
                    estado={est === 'ok' ? undefined : est}
                    nombreCategoria={p.categoria}
                    alTocar={() => agregar(p)}
                    alAgregar={() => agregar(p)}
                    enPedido={enRonda ? Math.round(enRonda.cantidad / 1000) : 0}
                  />
                );
              })}
            </Rejilla>
          )}
        </div>

        <aside class="vender__pedido" aria-label="Cuenta de la mesa">
          <h2 class="vender__titulo-pedido">Cuenta</h2>
          {panel}
        </aside>

        {(vistaRonda.lineas.length > 0 || cuenta) && (
          <div class="vender__barra" role="region" aria-label="Resumen de la mesa">
            <button type="button" class="vender__ver" onClick={() => setHoja(true)} aria-label="Ver la cuenta de la mesa">
              <span class="vender__cuenta cifras">{vistaRonda.lineas.length > 0 ? vistaRonda.articulos : cuenta ? articulos(estado, cuenta) : 0}</span>
              <span class="vender__total cifras">{pesos(totalBarra)}</span>
            </button>
            {vistaRonda.lineas.length > 0 ? (
              <Boton variante="primario" icono="check" desactivado={ocupado || sinCaja} alTocar={() => void enviar()}>
                Enviar
              </Boton>
            ) : (
              <Boton variante="tonal" alTocar={() => setHoja(true)}>
                Ver cuenta
              </Boton>
            )}
          </div>
        )}
      </div>

      {hoja && (
        <Hoja titulo={`Cuenta · ${mesa.nombre}`} alCerrar={() => setHoja(false)}>
          {panel}
        </Hoja>
      )}
      {cobrando && cuenta && (
        <Cobrar
          titulo={`Cobrar ${mesa.nombre}`}
          pedido={pedidoCuenta}
          total={vistaCuenta.total}
          cuentaId={cuenta.id}
          alCerrar={() => setCobrando(false)}
          alVender={(r) => {
            setCobrando(false);
            setDescuento({ tipoDescuento: 'ninguno', textoDescuento: '' });
            setHecho(`Cuenta cobrada por ${pesos(r.total)}.${r.cambio !== null && r.cambio > 0 ? ` Cambio: ${pesos(r.cambio)}.` : ''} La mesa queda libre.`);
          }}
        />
      )}
      {moviendo && cuenta && <Mover cuenta={cuenta} alCerrar={() => setMoviendo(false)} />}
      {quitando && cuenta && <Quitar cuenta={cuenta} productoId={quitando} alCerrar={() => setQuitando(null)} />}
      {anulando && cuenta && <Anular cuenta={cuenta} alCerrar={() => setAnulando(false)} />}
      {retirando && (
        <Dialogo
          titulo={`Retirar ${mesa.nombre}`}
          peligro
          etiquetaConfirmar="Retirar"
          alCerrar={() => setRetirando(false)}
          alConfirmar={() => {
            setRetirando(false);
            void correr(async () => {
              await negocio.retirarMesa(mesa.id);
              irA('#/mesas');
            });
          }}
        >
          La mesa sale del mapa. Su historia (cuentas cobradas) queda en el registro.
        </Dialogo>
      )}
    </Pagina>
  );
}

function Mover({ cuenta, alCerrar }: { cuenta: Cuenta; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  const { error, correr } = useOperacion();
  const libres = Object.values(estado.mesas)
    .filter((m) => m.activa && !cuentaDeMesa(estado, m.id))
    .sort((a, b) => a.zona.localeCompare(b.zona, 'es') || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  return (
    <Hoja titulo="Cambiar de mesa" alCerrar={alCerrar}>
      {libres.length === 0 ? (
        <EstadoVacio mensaje="No hay mesas libres." pista="Libera o cobra otra mesa primero." />
      ) : (
        <ul class="mesas__rejilla" aria-label="Mesas libres">
          {libres.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                class="mesa mesa--libre"
                onClick={() =>
                  void correr(async () => {
                    await negocio.trasladarCuenta(cuenta.id, m.id);
                    alCerrar();
                    irA(`#/mesas?mesa=${m.id}`);
                  })
                }
              >
                <span class="mesa__nombre">{m.nombre}</span>
                <span class="mesa__estado">{m.zona}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p class="mesas__error" role="alert">
          {error}
        </p>
      )}
    </Hoja>
  );
}

function Quitar({ cuenta, productoId, alCerrar }: { cuenta: Cuenta; productoId: string; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  const producto = estado.productos[productoId];
  const hay = cuenta.lineas.find((l) => l.productoId === productoId)?.cantidad ?? milesimas(0);
  const [cantidad, setCantidad] = useState(mostrarCantidad(hay));
  const [motivo, setMotivo] = useState('');
  const { error, setError, ocupado, correr } = useOperacion();

  async function quitar() {
    let q;
    try {
      q = leerCantidad(cantidad);
    } catch (e) {
      setError(textoError(e));
      return;
    }
    if (!motivo.trim()) {
      setError('Escribe el motivo: queda en el registro.');
      return;
    }
    if (await correr(() => negocio.quitarDeCuenta({ cuentaId: cuenta.id, productoId, cantidad: q, motivo }))) alCerrar();
  }

  return (
    <Hoja
      titulo={`Quitar ${producto?.nombre ?? 'producto'}`}
      alCerrar={alCerrar}
      pie={
        <div class="mesas__pie">
          {error && (
            <p class="mesas__error" role="alert">
              {error}
            </p>
          )}
          <Boton variante="peligro" ancho icono="papelera" desactivado={ocupado} alTocar={() => void quitar()}>
            Quitar de la cuenta
          </Boton>
        </div>
      }
    >
      <div class="mesas__formulario">
        <p>En la cuenta: {mostrarCantidad(hay)}. Lo que se quita no se cobra; el motivo queda firmado en el registro.</p>
        <CampoNumero etiqueta="Cantidad a quitar" valor={cantidad} alCambiar={setCantidad} />
        <CampoTexto etiqueta="Motivo" valor={motivo} alCambiar={setMotivo} marcador="Se pidió por error, no lo quisieron…" />
      </div>
    </Hoja>
  );
}

function Anular({ cuenta, alCerrar }: { cuenta: Cuenta; alCerrar: () => void }) {
  const { negocio } = useNegocio();
  const [motivo, setMotivo] = useState('');
  const { error, setError, ocupado, correr } = useOperacion();
  return (
    <Hoja
      titulo="Anular cuenta"
      alCerrar={alCerrar}
      pie={
        <div class="mesas__pie">
          {error && (
            <p class="mesas__error" role="alert">
              {error}
            </p>
          )}
          <Boton
            variante="peligro"
            ancho
            icono="papelera"
            desactivado={ocupado}
            alTocar={() => {
              if (!motivo.trim()) {
                setError('Escribe el motivo de la anulación.');
                return;
              }
              void correr(() => negocio.anularCuenta(cuenta.id, motivo)).then((ok) => ok && alCerrar());
            }}
          >
            Anular cuenta
          </Boton>
        </div>
      }
    >
      <div class="mesas__formulario">
        <p>
          La cuenta se cierra sin cobrar y la mesa queda libre. No se descuenta inventario: si lo servido se consumió, mejor cóbralo como
          cortesía (sale del inventario y queda en las ventas).
        </p>
        <CampoTexto etiqueta="Motivo" valor={motivo} alCambiar={setMotivo} marcador="Se fueron sin pagar, error de mesa…" />
      </div>
    </Hoja>
  );
}
