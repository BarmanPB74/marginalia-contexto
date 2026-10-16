import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  FORMAS_PAGO,
  mostrarCantidad,
  NOMBRE_FORMA,
  pesos,
  ReglaRota,
  type Centavos,
  type CuentaPorPagar,
  type Cuadre,
  type FormaPago,
  type Resumen,
  type VentaPorProducto,
} from '../../core/negocio';
import { diaDe, type Dia } from '../../core/notas/fechas';
import { Boton } from '../../ui/Boton';
import type { Categoria } from '../../ui/categorias';
import { Cifra } from '../../ui/Cifra';
import { Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Icono } from '../../ui/Icono';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { SelectorFecha } from '../../ui/SelectorFecha';
import { Tabla } from '../../ui/Tabla';
import { useNegocio } from '../negocio/contexto';
import { exportarResumen, exportarVentas } from './exportar';
import { GraficoBarras } from './GraficoBarras';
import { diaCorto, momentoCorto, periodoDe, TIPOS_PERIODO, type TipoPeriodo } from './periodo';
import { VerificarRegistro } from './VerificarRegistro';
import './Contabilidad.css';

/** Color de cada forma de pago en el gráfico (paleta categórica). */
const COLOR_FORMA: Record<FormaPago, Categoria> = {
  efectivo: 'esmeralda',
  tarjeta: 'indigo',
  transferencia: 'cielo',
  cortesia: 'ambar',
};

/** Cuántos productos se muestran en «más vendidos». */
const TOP_PRODUCTOS = 10;

type Carga = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; resumen: Resumen };

/**
 * Contabilidad (dueño): cifras del período tal como las da `negocio.contabilidad` (la pantalla no
 * suma nada por su cuenta), exportar CSV y verificar el diario. No es contabilidad oficial.
 */
export function PantallaContabilidad() {
  const { negocio, estado } = useNegocio();
  const puedeVer = negocio.puede('contabilidad.ver');
  const hoy = new Date();
  const diaHoy = diaDe(hoy);
  const [tipo, setTipo] = useState<TipoPeriodo>('hoy');
  const [rango, setRango] = useState<{ desde: Dia; hasta: Dia }>({ desde: diaHoy, hasta: diaHoy });
  const [eligiendo, setEligiendo] = useState<'desde' | 'hasta' | null>(null);
  const [carga, setCarga] = useState<Carga>({ tipo: 'cargando' });
  const [aviso, setAviso] = useState('');
  const [exportando, setExportando] = useState(false);
  const periodo = periodoDe(tipo, hoy, rango);

  useEffect(() => {
    if (!puedeVer) return;
    let vigente = true;
    negocio.contabilidad(periodo).then(
      (resumen) => vigente && setCarga({ tipo: 'listo', resumen }),
      (e: unknown) => vigente && setCarga({ tipo: 'error', mensaje: e instanceof ReglaRota ? e.message : 'No se pudo leer el registro.' }),
    );
    return () => {
      vigente = false;
    };
    // `estado` cambia con cada movimiento nuevo: las cifras se rehacen solas
  }, [negocio, estado, puedeVer, periodo.desde, periodo.hasta]);

  if (!puedeVer) {
    return (
      <Pagina>
        <Encabezado titulo="Contabilidad" />
        <EstadoVacio mensaje="Esta sección es del dueño." pista="Tu cargo no permite ver la contabilidad. Pídesela al dueño." />
      </Pagina>
    );
  }

  async function exportar(que: 'resumen' | 'ventas') {
    setExportando(true);
    setAviso('');
    try {
      setAviso(await (que === 'resumen' ? exportarResumen(negocio, periodo, hoy) : exportarVentas(negocio, periodo, hoy)));
    } catch (e) {
      setAviso(e instanceof ReglaRota ? e.message : 'No se pudo exportar. Prueba otra vez.');
    } finally {
      setExportando(false);
    }
  }

  const textoPeriodo = periodo.desde === periodo.hasta ? diaCorto(periodo.desde) : `${diaCorto(periodo.desde)} a ${diaCorto(periodo.hasta)}`;
  const puedeExportar = negocio.puede('contabilidad.exportar');

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Contabilidad" />
      <p class="conta__aviso" role="note">
        <Icono nombre="alerta" tamano={20} />
        <span>Registro interno de apoyo. No es factura electrónica ni contabilidad oficial.</span>
      </p>

      <section class="conta__periodo" aria-label="Período">
        <Segmentado etiqueta="Período" opciones={TIPOS_PERIODO} valor={tipo} alCambiar={setTipo} />
        {tipo === 'rango' && (
          <div class="conta__rango">
            <Boton icono="calendario" alTocar={() => setEligiendo('desde')} etiqueta={`Desde: ${diaCorto(rango.desde)}. Cambiar`}>
              Desde {diaCorto(rango.desde)}
            </Boton>
            <Boton icono="calendario" alTocar={() => setEligiendo('hasta')} etiqueta={`Hasta: ${diaCorto(rango.hasta)}. Cambiar`}>
              Hasta {diaCorto(rango.hasta)}
            </Boton>
          </div>
        )}
        <p class="conta__texto-periodo" aria-live="polite">
          {textoPeriodo}
        </p>
      </section>

      {eligiendo && (
        <SelectorFecha
          hoy={diaHoy}
          alCerrar={() => setEligiendo(null)}
          alElegir={(d) => {
            setRango((r) => (eligiendo === 'desde' ? { ...r, desde: d } : { ...r, hasta: d }));
            setEligiendo(null);
          }}
        />
      )}

      {carga.tipo === 'cargando' && <p aria-busy="true">Sumando el registro…</p>}
      {carga.tipo === 'error' && (
        <p class="conta__error" role="alert">
          {carga.mensaje}
        </p>
      )}
      {carga.tipo === 'listo' && <Informe r={carga.resumen} hoy={diaHoy} nombres={(id) => estado.usuarios[id]?.nombre ?? '—'} />}

      <section class="conta__seccion" aria-labelledby="conta-datos">
        <h2 id="conta-datos" class="conta__titulo">
          Exportar y verificar
        </h2>
        {puedeExportar && (
          <>
            <div class="conta__botones">
              <Boton icono="exportar" desactivado={exportando} alTocar={() => void exportar('resumen')}>
                Exportar CSV (resumen)
              </Boton>
              <Boton icono="exportar" desactivado={exportando} alTocar={() => void exportar('ventas')}>
                Exportar CSV (ventas)
              </Boton>
            </div>
            <p class="conta__pista">Del período elegido, separado por «;» para Excel o para tu contador.</p>
            {aviso && (
              <p class="conta__resultado" aria-live="polite">
                {aviso}
              </p>
            )}
          </>
        )}
        {negocio.puede('diario.verificar') && <VerificarRegistro negocio={negocio} />}
      </section>
    </Pagina>
  );
}

function Informe({ r, hoy, nombres }: { r: Resumen; hoy: Dia; nombres: (id: string) => string }) {
  const v = r.ventas;
  const detalleVentas = `${v.cantidad} ${v.cantidad === 1 ? 'venta' : 'ventas'}${v.anuladas ? ` · ${v.anuladas} anulada${v.anuladas === 1 ? '' : 's'}` : ''}`;
  const descuentos = v.descuentos > 0 ? ` · descuentos ${pesos(v.descuentos)}` : '';
  const gastos = Object.entries(r.gastos.porCategoria).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  const productos = r.porProducto.slice(0, TOP_PRODUCTOS);

  return (
    <>
      <Rejilla tipo="cifra" etiqueta="Cifras del período">
        <Tarjeta>
          <Cifra etiqueta="Ventas netas" valor={pesos(v.netas)} icono="vender" color="indigo" />
          <p class="conta__nota">
            {detalleVentas}
            {descuentos}
          </p>
        </Tarjeta>
        <Tarjeta>
          <Cifra etiqueta="Ingreso real" valor={pesos(v.ingresoReal)} icono="caja" color="esmeralda" />
          <p class="conta__nota">Ventas netas sin cortesías: la plata que entró.</p>
        </Tarjeta>
        <Tarjeta>
          <Cifra etiqueta="Costo de ventas" valor={pesos(r.costoVentas)} icono="inventario" color="coral" />
          <p class="conta__nota">
            <Insignia tono="aviso">aproximado</Insignia> Usa el costo actual de cada producto (el de su última factura), no el
            que tenía el día de la venta.
            {r.productosSinCosto.length > 0 && ` Sin costo, no suman: ${r.productosSinCosto.join(', ')}.`}
          </p>
        </Tarjeta>
        <Tarjeta>
          <Cifra etiqueta="Margen" valor={pesos(r.margenBruto)} icono="contabilidad" color="turquesa" />
          <p class="conta__nota">Ingreso real menos costo de ventas (aproximado).</p>
        </Tarjeta>
        <Tarjeta>
          <Cifra etiqueta="Gastos" valor={pesos(r.gastos.total)} icono="gasto" color="fucsia" />
          <p class="conta__nota">Resultado aproximado (margen − gastos): {pesos(r.resultadoAproximado)}</p>
        </Tarjeta>
        <Tarjeta>
          <Cifra etiqueta="Pagos a proveedores" valor={pesos(r.pagosProveedores.total)} icono="factura" color="cielo" />
          <p class="conta__nota">
            {r.compras.cantidad} factura{r.compras.cantidad === 1 ? '' : 's'} registrada{r.compras.cantidad === 1 ? '' : 's'} por{' '}
            {pesos(r.compras.total)}
          </p>
        </Tarjeta>
        <Tarjeta>
          <Cifra etiqueta="Cuentas por pagar" valor={pesos(r.totalPorPagar)} icono="alerta" color="ambar" />
          <p class="conta__nota">Lo que se debe hoy, sea cual sea el período.</p>
        </Tarjeta>
      </Rejilla>

      <section class="conta__seccion" aria-labelledby="conta-formas">
        <h2 id="conta-formas" class="conta__titulo">
          Ventas por forma de pago
        </h2>
        {v.cantidad === 0 ? (
          <p class="conta__pista">Sin ventas en este período.</p>
        ) : (
          <GraficoBarras
            titulo="Ventas por forma de pago"
            barras={FORMAS_PAGO.map((f) => ({
              clave: f,
              etiqueta: NOMBRE_FORMA[f],
              valor: v.porForma[f],
              texto: pesos(v.porForma[f]),
              color: COLOR_FORMA[f],
            }))}
          />
        )}
        <Tabla<FormaPago>
          titulo="Ventas por forma de pago"
          columnas={[
            { clave: 'forma', titulo: 'Forma de pago', principal: true, celda: (f) => NOMBRE_FORMA[f] },
            { clave: 'valor', titulo: 'Valor', numerica: true, celda: (f) => pesos(v.porForma[f]) },
          ]}
          filas={FORMAS_PAGO}
          claveFila={(f) => f}
        />
      </section>

      <section class="conta__seccion" aria-labelledby="conta-productos">
        <h2 id="conta-productos" class="conta__titulo">
          Productos más vendidos
        </h2>
        <Tabla<VentaPorProducto>
          titulo="Productos más vendidos"
          columnas={[
            { clave: 'nombre', titulo: 'Producto', principal: true, celda: (p) => p.nombre },
            { clave: 'cantidad', titulo: 'Cantidad', numerica: true, celda: (p) => mostrarCantidad(p.cantidad) },
            { clave: 'ingreso', titulo: 'Vendido', numerica: true, celda: (p) => pesos(p.ingreso) },
          ]}
          filas={productos}
          claveFila={(p) => p.productoId}
          vacia="Sin ventas en este período."
        />
        {r.porProducto.length > TOP_PRODUCTOS && (
          <p class="conta__pista">
            Los {TOP_PRODUCTOS} primeros de {r.porProducto.length}. El CSV del resumen trae todos.
          </p>
        )}
      </section>

      <section class="conta__seccion" aria-labelledby="conta-gastos">
        <h2 id="conta-gastos" class="conta__titulo">
          Gastos por categoría
        </h2>
        <Tabla<[string, Centavos]>
          titulo="Gastos por categoría"
          columnas={[
            { clave: 'categoria', titulo: 'Categoría', principal: true, celda: ([c]) => c },
            { clave: 'valor', titulo: 'Valor', numerica: true, celda: ([, m]) => pesos(m) },
          ]}
          filas={gastos}
          claveFila={([c]) => c}
          vacia="Sin gastos en este período."
        />
      </section>

      <section class="conta__seccion" aria-labelledby="conta-cuentas">
        <h2 id="conta-cuentas" class="conta__titulo">
          Cuentas por pagar
        </h2>
        <Tabla<CuentaPorPagar>
          titulo="Cuentas por pagar"
          columnas={[
            { clave: 'factura', titulo: 'Factura', principal: true, celda: (c) => `${c.proveedor} · ${c.numero}` },
            { clave: 'vence', titulo: 'Vence', celda: (c) => <Vence vence={c.vence} hoy={hoy} /> },
            { clave: 'saldo', titulo: 'Saldo', numerica: true, celda: (c) => pesos(c.saldo) },
          ]}
          filas={r.cuentasPorPagar}
          claveFila={(c) => c.compraId}
          vacia="No se debe nada."
        />
      </section>

      <section class="conta__seccion" aria-labelledby="conta-cuadres">
        <h2 id="conta-cuadres" class="conta__titulo">
          Cuadres de caja
        </h2>
        <Tabla<Cuadre>
          titulo="Cuadres de caja"
          columnas={[
            { clave: 'cerrada', titulo: 'Cierre', principal: true, celda: (c) => momentoCorto(c.cerradaEn) },
            { clave: 'por', titulo: 'Cerró', celda: (c) => nombres(c.cerradaPor) },
            { clave: 'esperado', titulo: 'Esperado', numerica: true, celda: (c) => pesos(c.esperado) },
            { clave: 'contado', titulo: 'Contado', numerica: true, celda: (c) => pesos(c.contado) },
            { clave: 'diferencia', titulo: 'Diferencia', celda: (c) => <Diferencia valor={c.diferencia} /> },
          ]}
          filas={r.cuadres}
          claveFila={(c) => c.cajaId}
          vacia="No se cerró ninguna caja en este período."
        />
        {r.cuadres.length > 0 && (
          <p class="conta__pista">
            Diferencia total: <Diferencia valor={r.diferenciaCajas} />
          </p>
        )}
      </section>
    </>
  );
}

function Tarjeta({ children }: { children: ComponentChildren }) {
  return <div class="conta__cifra">{children}</div>;
}

function Vence({ vence, hoy }: { vence: string | null; hoy: Dia }) {
  if (!vence) return <span class="conta__suave">Sin fecha</span>;
  if (vence < hoy) {
    return (
      <span class="conta__vence">
        {diaCorto(vence)} <Insignia tono="peligro">Vencida</Insignia>
      </span>
    );
  }
  if (vence === hoy) {
    return (
      <span class="conta__vence">
        {diaCorto(vence)} <Insignia tono="aviso">Vence hoy</Insignia>
      </span>
    );
  }
  return <span>{diaCorto(vence)}</span>;
}

function Diferencia({ valor }: { valor: Centavos }) {
  if (valor === 0) return <Insignia tono="exito">Cuadró</Insignia>;
  return valor < 0 ? (
    <Insignia tono="peligro">Faltó {pesos(-valor as Centavos)}</Insignia>
  ) : (
    <Insignia tono="aviso">Sobró {pesos(valor)}</Insignia>
  );
}
