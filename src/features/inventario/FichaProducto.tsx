import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { mostrarCantidad, pesos, stockDe, sugerido, milesimas, type MovimientoStock, type Producto } from '../../core/negocio';
import { useEstado } from '../../app/estado';
import { Boton } from '../../ui/Boton';
import { Cifra } from '../../ui/Cifra';
import { Dialogo } from '../../ui/Dialogo';
import { Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Tabla } from '../../ui/Tabla';
import { useNegocio } from '../negocio/contexto';
import { ABREV_UNIDAD, estadoStock, fechaHora, ir, mensajeDe, NOMBRE_ESTADO_STOCK, NOMBRE_UNIDAD, nombreUsuario } from './comun';
import { Aviso, FormularioProducto, HojaAjuste, HojaContar } from './formularios';
import { textoExistencias } from './copas';

const NOMBRE_MOVIMIENTO: Record<MovimientoStock['tipo'], string> = {
  venta: 'Venta',
  anulacion: 'Venta anulada',
  compra: 'Compra',
  ajuste: 'Ajuste',
};
const NOMBRE_MOTIVO: Record<string, string> = {
  conteo: 'Conteo',
  merma: 'Merma',
  consumo: 'Consumo',
  correccion: 'Corrección',
  importacion: 'Importación',
};

/** «merma: se rompió» → «Merma: se rompió»; «factura 123» tal cual. */
function detalle(m: MovimientoStock): string {
  if (m.tipo !== 'ajuste') return m.tipo === 'venta' ? NOMBRE_MOVIMIENTO.venta : `${NOMBRE_MOVIMIENTO[m.tipo]} · ${m.detalle}`;
  const [motivo = '', ...resto] = m.detalle.split(':');
  const nombre = NOMBRE_MOTIVO[motivo.trim()] ?? motivo;
  return resto.length ? `${nombre}:${resto.join(':')}` : nombre;
}

type Abierta = 'contar' | 'ajustar' | 'editar' | 'archivar' | 'descontinuar' | null;

/** El lienzo de la ficha: página propia (teléfono) o panel al lado de la lista (pantalla dividida). */
function Lienzo({ lateral, titulo, children }: { lateral: boolean; titulo: string; children: ComponentChildren }) {
  if (!lateral) return <Pagina ancho="amplio">{children}</Pagina>;
  return (
    <aside class="inv-lateral" aria-label={`Ficha de ${titulo}`}>
      {children}
    </aside>
  );
}

/**
 * Ficha de un producto (`#/inventario?producto=<id>`): cifras, datos, acciones e historial.
 * `lateral`: se dibuja como panel a la derecha de la lista (pantalla dividida).
 */
export function FichaProducto({ id, lateral = false }: { id: string; lateral?: boolean }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const producto = estado.productos[id];
  const [abierta, setAbierta] = useState<Abierta>(null);
  const [movimientos, setMovimientos] = useState<MovimientoStock[] | null>(null);
  const [error, setError] = useState('');

  // Se relee el historial con cada evento nuevo (estado.eventos cambia)
  useEffect(() => {
    let vigente = true;
    negocio.movimientosStock(id).then(
      (m) => vigente && setMovimientos([...m].reverse()),
      () => vigente && setMovimientos([]),
    );
    return () => {
      vigente = false;
    };
  }, [negocio, id, estado.eventos]);

  const volver = { etiqueta: lateral ? 'Cerrar' : 'Volver', alTocar: () => ir('#/inventario') };
  if (!producto) {
    return (
      <Lienzo lateral={lateral} titulo="producto">
        <Encabezado titulo="Producto" accion={volver} />
        <EstadoVacio mensaje="Ese producto no existe." pista="Vuelve al inventario y búscalo otra vez." />
      </Lienzo>
    );
  }
  const p: Producto = producto;
  const stock = stockDe(estado, p.id);
  const u = ABREV_UNIDAD[p.unidad];
  // Descontinuado: sus existencias ya no son alerta
  const est = p.descontinuado ? 'ok' : estadoStock(stock, p.stockMinimo);
  const verCostos = negocio.puede('inventario.verCostos');

  async function descontinuar(si: boolean) {
    setError('');
    try {
      await negocio.descontinuarProducto(p.id, si);
      avisar(si ? `«${p.nombre}» descontinuado: ya no se vende ni da alertas.` : `«${p.nombre}» vuelve a la venta.`);
    } catch (e) {
      setError(mensajeDe(e));
    }
    setAbierta(null);
  }

  async function archivar() {
    setError('');
    try {
      await negocio.archivarProducto(p.id);
      avisar(`«${p.nombre}» archivado.`);
      setAbierta(null);
      ir('#/inventario');
    } catch (e) {
      setAbierta(null);
      setError(mensajeDe(e));
    }
  }

  return (
    <Lienzo lateral={lateral} titulo={p.nombre}>
      <Encabezado titulo={p.nombre} accion={volver} />
      <div class="inv-ficha">
        <p class="inv-ficha__estado">
          <span>{p.categoria}</span>
          {!p.activo && <Insignia tono="neutro">Archivado</Insignia>}
          {p.descontinuado && <Insignia tono="neutro">Descontinuado</Insignia>}
          {est !== 'ok' && (
            <Insignia tono={est === 'bajo' ? 'aviso' : 'peligro'} icono="alerta">
              {NOMBRE_ESTADO_STOCK[est]}
            </Insignia>
          )}
        </p>

        <Rejilla tipo="cifra" etiqueta="Cifras del producto">
          <Cifra etiqueta="Existencias" icono="inventario" valor={textoExistencias(stock, p, u)} color={est === 'ok' ? 'esmeralda' : 'coral'} />
          <Cifra etiqueta="Mínimo" valor={p.stockMinimo === null ? '—' : `${mostrarCantidad(p.stockMinimo)} ${u}`} color="cielo" />
          <Cifra
            etiqueta="Sugerido para pedir"
            icono="factura"
            valor={p.stockMinimo === null ? '—' : `${mostrarCantidad(sugerido(stock, p.stockMinimo))} ${u}`}
            color="ambar"
          />
          <Cifra etiqueta="Precio de venta" icono="vender" valor={pesos(p.precio)} color="indigo" />
          {verCostos && <Cifra etiqueta="Último costo" icono="gasto" valor={p.costo === null ? '—' : pesos(p.costo)} color="turquesa" />}
        </Rejilla>

        <dl class="inv-datos">
          <div>
            <dt>Unidad</dt>
            <dd>{NOMBRE_UNIDAD[p.unidad]}</dd>
          </div>
          <div>
            <dt>Código</dt>
            <dd>{p.codigo ?? '—'}</dd>
          </div>
          {p.copas && (
            <div>
              <dt>Copas por botella</dt>
              <dd class="cifras">{p.copas}</dd>
            </div>
          )}
          {verCostos && p.costo !== null && p.precio > 0 && (
            <div>
              <dt>Margen</dt>
              <dd class="cifras">{Math.round(((p.precio - p.costo) / p.precio) * 100)} %</dd>
            </div>
          )}
        </dl>

        {p.activo && (
          <div class="inv-acciones" role="group" aria-label="Acciones del producto">
            {negocio.puede('inventario.contar') && (
              <Boton variante="primario" icono="check" alTocar={() => setAbierta('contar')}>
                Contar
              </Boton>
            )}
            {negocio.puede('inventario.ajustar') && (
              <Boton icono="menos" alTocar={() => setAbierta('ajustar')}>
                Merma o corrección
              </Boton>
            )}
            {negocio.puede('producto.editar') && (
              <Boton icono="editar" alTocar={() => setAbierta('editar')}>
                Editar
              </Boton>
            )}
            {negocio.puede('producto.editar') &&
              (p.descontinuado ? (
                <Boton variante="tonal" icono="vender" alTocar={() => void descontinuar(false)}>
                  Volver a vender
                </Boton>
              ) : (
                <Boton variante="texto" icono="cerrar" alTocar={() => setAbierta('descontinuar')}>
                  Descontinuado
                </Boton>
              ))}
            {negocio.puede('producto.archivar') && (
              <Boton variante="texto" icono="papelera" alTocar={() => setAbierta('archivar')}>
                Archivar
              </Boton>
            )}
          </div>
        )}
        <Aviso texto={error} />

        <section class="inv-seccion" aria-labelledby="inv-historial">
          <h2 class="inv-seccion__titulo" id="inv-historial">
            Movimientos
          </h2>
          {movimientos === null ? (
            <p class="inv-suave">Cargando…</p>
          ) : (
            <Tabla
              titulo={`Movimientos de ${p.nombre}`}
              columnas={[
                { clave: 'que', titulo: 'Movimiento', principal: true, celda: (m: MovimientoStock) => detalle(m) },
                { clave: 'en', titulo: 'Fecha', celda: (m: MovimientoStock) => fechaHora(m.en) },
                {
                  clave: 'delta',
                  titulo: 'Cambio',
                  numerica: true,
                  celda: (m: MovimientoStock) => `${m.delta > 0 ? '+' : ''}${mostrarCantidad(milesimas(m.delta))} ${u}`,
                },
                { clave: 'por', titulo: 'Quién', celda: (m: MovimientoStock) => nombreUsuario(estado, m.por) },
              ]}
              filas={movimientos}
              claveFila={(m) => m.eventoId}
              vacia="Sin movimientos todavía."
            />
          )}
        </section>
      </div>

      {abierta === 'contar' && <HojaContar producto={p} alCerrar={() => setAbierta(null)} />}
      {abierta === 'ajustar' && <HojaAjuste producto={p} alCerrar={() => setAbierta(null)} />}
      {abierta === 'editar' && <FormularioProducto producto={p} alCerrar={() => setAbierta(null)} />}
      {abierta === 'descontinuar' && (
        <Dialogo
          titulo={`¿«${p.nombre}» está descontinuado?`}
          etiquetaConfirmar="Marcar descontinuado"
          alCerrar={() => setAbierta(null)}
          alConfirmar={() => void descontinuar(true)}
        >
          <p>
            Ya no se vende (sale de Vender y de las mesas), no da alertas de existencias ni de pedido y no entra en los conteos por
            categoría. Su historial se conserva y lo puedes volver a vender cuando quieras.
          </p>
        </Dialogo>
      )}
      {abierta === 'archivar' && (
        <Dialogo
          titulo={`¿Archivar «${p.nombre}»?`}
          etiquetaConfirmar="Archivar"
          peligro
          alCerrar={() => setAbierta(null)}
          alConfirmar={() => void archivar()}
        >
          <p>Deja de aparecer para vender y en el inventario activo. Su historial se conserva.</p>
        </Dialogo>
      )}
    </Lienzo>
  );
}
