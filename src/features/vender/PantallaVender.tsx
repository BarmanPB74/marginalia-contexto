import { useEffect, useMemo, useState } from 'preact/hooks';
import { pesos, stockDe, type Centavos, type Producto } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { Buscador } from '../../ui/Buscador';
import { Chip, GrupoChips } from '../../ui/Chip';
import { Disposicion, Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Hoja } from '../../ui/Hoja';
import { Pagina } from '../../ui/Pagina';
import { Pestanas } from '../../ui/Pestanas';
import { Segmentado } from '../../ui/Segmentado';
import { TarjetaProducto } from '../../ui/TarjetaProducto';
import { useNegocio } from '../negocio/contexto';
import { AbrirCaja } from '../caja/AbrirCaja';
import { cantidadCon } from '../caja/comun';
import { Cobrar } from './Cobrar';
import { Pedido } from './PanelPedido';
import { enPedido, existencias, guardarPedido, pedidoGuardado, sumar, vistaPrevia, PEDIDO_VACIO, type Pedido as TPedido } from './pedido';
import { VentasHoy } from './VentasHoy';
import './PantallaVender.css';

type Vista = 'productos' | 'ventas';
type FiltroExistencias = 'todas' | 'con' | 'agotadas';
type Orden = 'nombre' | 'precio';

const norma = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');

/**
 * Vender (NEGOCIO §4.2): punto de venta para teléfono y tableta. Rejilla de productos con
 * buscador, categorías y filtros; el pedido es una columna fija a la derecha (≥ 840 px) o una
 * barra inferior que abre una hoja (compacto). Sin caja abierta no se vende.
 */
export function PantallaVender() {
  const { negocio, estado } = useNegocio();
  const [vista, setVista] = useState<Vista>('productos');

  if (!negocio.puede('venta.registrar')) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Vender" />
        <EstadoVacio mensaje="Tu cargo no permite vender." pista="Pídele al dueño que te dé un usuario de caja." />
      </Pagina>
    );
  }

  if (!estado.caja) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Vender" />
        <div class="vender-sin-caja">
          <EstadoVacio mensaje="No hay caja abierta." pista="Sin caja abierta no se puede vender. Abre la caja con la base del día." />
          {negocio.puede('caja.abrir') && <BotonAbrirCaja />}
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Vender" />
      <Pestanas
        etiqueta="Vender"
        pestanas={[
          { id: 'productos', etiqueta: 'Productos' },
          { id: 'ventas', etiqueta: 'Ventas de hoy', contador: Object.keys(estado.ventas).length },
        ]}
        actual={vista}
        alCambiar={setVista}
      >
        {vista === 'productos' ? <PuntoDeVenta /> : <VentasHoy />}
      </Pestanas>
    </Pagina>
  );
}

function BotonAbrirCaja() {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton variante="primario" icono="caja" alTocar={() => setAbierta(true)}>
        Abrir caja
      </Boton>
      {abierta && (
        <Hoja titulo="Abrir caja" alCerrar={() => setAbierta(false)}>
          <AbrirCaja alAbrir={() => setAbierta(false)} />
        </Hoja>
      )}
    </>
  );
}

function PuntoDeVenta() {
  const { negocio, estado } = useNegocio();
  const [pedido, setPedidoLocal] = useState<TPedido>(() => pedidoGuardado(negocio));
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [filtroStock, setFiltroStock] = useState<FiltroExistencias>('todas');
  const [orden, setOrden] = useState<Orden>('nombre');
  const [hojaPedido, setHojaPedido] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [hecho, setHecho] = useState('');

  const setPedido = (p: TPedido) => {
    setPedidoLocal(p);
    setHecho('');
  };
  useEffect(() => guardarPedido(negocio, pedido), [negocio, pedido]);

  const activos = useMemo(() => Object.values(estado.productos).filter((p) => p.activo), [estado.productos]);
  const categorias = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const p of activos) cuenta.set(p.categoria, (cuenta.get(p.categoria) ?? 0) + 1);
    return [...cuenta].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [activos]);

  const q = norma(busqueda.trim());
  const visibles = activos
    .filter((p) => categoria === null || p.categoria === categoria)
    .filter((p) => !q || norma(p.nombre).includes(q) || (p.codigo !== undefined && norma(p.codigo) === q))
    .filter((p) => {
      if (filtroStock === 'todas') return true;
      const agotado = stockDe(estado, p.id) <= 0;
      return filtroStock === 'agotadas' ? agotado : !agotado;
    })
    .sort((a, b) => (orden === 'precio' ? a.precio - b.precio : 0) || a.nombre.localeCompare(b.nombre, 'es'));

  const vista = vistaPrevia(pedido, estado);
  const agregar = (p: Producto) => setPedido(sumar(pedido, p.id));

  function vendido(r: { total: Centavos; cambio: Centavos | null }) {
    setCobrando(false);
    setHojaPedido(false);
    setPedido(PEDIDO_VACIO);
    setHecho(`Venta registrada por ${pesos(r.total)}.${r.cambio !== null && r.cambio > 0 ? ` Cambio: ${pesos(r.cambio)}.` : ''}`);
  }

  const panelFiltros = (
    <>
      <fieldset class="vender__grupo">
        <legend>Existencias</legend>
        <GrupoChips etiqueta="Existencias">
          {(
            [
              ['todas', 'Todas'],
              ['con', 'Con existencias'],
              ['agotadas', 'Agotadas'],
            ] as const
          ).map(([v, t]) => (
            <Chip key={v} seleccionado={filtroStock === v} alCambiar={() => setFiltroStock(v)}>
              {t}
            </Chip>
          ))}
        </GrupoChips>
      </fieldset>
      <fieldset class="vender__grupo">
        <legend>Ordenar por</legend>
        <Segmentado
          etiqueta="Ordenar por"
          opciones={[
            { valor: 'nombre', etiqueta: 'Nombre' },
            { valor: 'precio', etiqueta: 'Precio' },
          ]}
          valor={orden}
          alCambiar={setOrden}
        />
      </fieldset>
    </>
  );

  const pedidoPanel = <Pedido pedido={pedido} vista={vista} alCambiar={setPedido} alCobrar={() => setCobrando(true)} />;

  return (
    <div class={`vender${vista.lineas.length > 0 ? ' vender--con-pedido' : ''}`}>
      <div class="vender__catalogo">
        {hecho && (
          <p class="mensaje-hecho" role="status">
            {hecho}
          </p>
        )}
        <Disposicion
          panel={panelFiltros}
          activos={(filtroStock !== 'todas' ? 1 : 0) + (orden !== 'nombre' ? 1 : 0)}
          barra={<Buscador etiqueta="Buscar productos" valor={busqueda} alCambiar={setBusqueda} marcador="Buscar por nombre o código" />}
        >
          {categorias.length > 1 && (
            <GrupoChips etiqueta="Categorías">
              <Chip seleccionado={categoria === null} alCambiar={() => setCategoria(null)}>
                Todas
              </Chip>
              {categorias.map(([c, n]) => (
                <Chip key={c} seleccionado={categoria === c} contador={n} alCambiar={(s) => setCategoria(s ? c : null)}>
                  {c}
                </Chip>
              ))}
            </GrupoChips>
          )}
          {activos.length === 0 ? (
            <EstadoVacio
              mensaje="No hay productos para vender."
              pista={negocio.puede('inventario.ver') ? 'Créalos o impórtalos en Inventario.' : 'Pídele al dueño que cree los productos.'}
            />
          ) : visibles.length === 0 ? (
            <EstadoVacio mensaje="Ningún producto coincide." pista="Prueba con otra palabra o quita los filtros." />
          ) : (
            <Rejilla etiqueta="Productos">
              {visibles.map((p) => {
                const est = existencias(estado, p);
                return (
                  <TarjetaProducto
                    key={p.id}
                    nombre={p.nombre}
                    precio={pesos(p.precio)}
                    existencias={cantidadCon(stockDe(estado, p.id), p.unidad)}
                    estado={est === 'ok' ? undefined : est}
                    nombreCategoria={p.categoria}
                    alTocar={() => agregar(p)}
                    alAgregar={() => agregar(p)}
                    enPedido={enPedido(pedido, p.id)}
                  />
                );
              })}
            </Rejilla>
          )}
        </Disposicion>
      </div>

      {/* Ancho: columna fija a la derecha */}
      <aside class="vender__pedido" aria-label="Pedido">
        <h2 class="vender__titulo-pedido">Pedido</h2>
        {pedidoPanel}
      </aside>

      {/* Compacto: barra con el total que abre el pedido en una hoja */}
      {vista.lineas.length > 0 && (
        <div class="vender__barra" role="region" aria-label="Resumen del pedido">
          <button type="button" class="vender__ver" onClick={() => setHojaPedido(true)} aria-label={`Ver pedido: ${vista.articulos} artículos, ${pesos(vista.total)}`}>
            <span class="vender__cuenta cifras">{vista.articulos}</span>
            <span class="vender__total cifras">{pesos(vista.total)}</span>
          </button>
          <Boton variante="primario" icono="caja" desactivado={vista.errorDescuento !== null} alTocar={() => setCobrando(true)}>
            Cobrar
          </Boton>
        </div>
      )}
      {hojaPedido && (
        <Hoja
          titulo="Pedido"
          alCerrar={() => setHojaPedido(false)}
          pie={
            vista.lineas.length > 0 ? (
              <div class="vender__pie-hoja">
                <Boton variante="texto" icono="papelera" alTocar={() => setPedido({ ...pedido, lineas: [] })}>
                  Vaciar
                </Boton>
                <Boton
                  variante="primario"
                  icono="caja"
                  desactivado={vista.errorDescuento !== null}
                  alTocar={() => {
                    setHojaPedido(false);
                    setCobrando(true);
                  }}
                >
                  Cobrar {pesos(vista.total)}
                </Boton>
              </div>
            ) : undefined
          }
        >
          <Pedido pedido={pedido} vista={vista} alCambiar={setPedido} conAcciones={false} alCobrar={() => setCobrando(true)} />
        </Hoja>
      )}
      {cobrando && <Cobrar pedido={pedido} total={vista.total} alCerrar={() => setCobrando(false)} alVender={vendido} />}
    </div>
  );
}
