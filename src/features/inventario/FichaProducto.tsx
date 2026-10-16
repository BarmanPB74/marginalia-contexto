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

type Abierta = 'contar' | 'ajustar' | 'editar' | 'archivar' | null;

/** Ficha de un producto (`#/inventario?producto=<id>`): cifras, datos, acciones e historial. */
export function FichaProducto({ id }: { id: string }) {
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

  if (!producto) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Producto" accion={{ etiqueta: 'Volver', alTocar: () => ir('#/inventario') }} />
        <EstadoVacio mensaje="Ese producto no existe." pista="Vuelve al inventario y búscalo otra vez." />
      </Pagina>
    );
  }
  const p: Producto = producto;
  const stock = stockDe(estado, p.id);
  const u = ABREV_UNIDAD[p.unidad];
  const est = estadoStock(stock, p.stockMinimo);
  const verCostos = negocio.puede('inventario.verCostos');

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
    <Pagina ancho="amplio">
      <Encabezado titulo={p.nombre} accion={{ etiqueta: 'Volver', alTocar: () => ir('#/inventario') }} />
      <div class="inv-ficha">
        <p class="inv-ficha__estado">
          <span>{p.categoria}</span>
          {!p.activo && <Insignia tono="neutro">Archivado</Insignia>}
          {est !== 'ok' && (
            <Insignia tono={est === 'bajo' ? 'aviso' : 'peligro'} icono="alerta">
              {NOMBRE_ESTADO_STOCK[est]}
            </Insignia>
          )}
        </p>

        <Rejilla tipo="cifra" etiqueta="Cifras del producto">
          <Cifra etiqueta="Existencias" icono="inventario" valor={`${mostrarCantidad(stock)} ${u}`} color={est === 'ok' ? 'esmeralda' : 'coral'} />
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
    </Pagina>
  );
}
