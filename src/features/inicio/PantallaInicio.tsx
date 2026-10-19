import { useState } from 'preact/hooks';
import { alertas, FORMAS_PAGO, mostrarCantidad, NOMBRE_ROL, nombreDe, pesos, situacionReserva, type Accion } from '../../core/negocio';
import { diaDe } from '../../core/notas/fechas';
import type { IdSeccion } from '../../app/rutas';
import { Boton } from '../../ui/Boton';
import { Cifra } from '../../ui/Cifra';
import { Rejilla } from '../../ui/Disposicion';
import { Encabezado } from '../../ui/Encabezado';
import { Hoja } from '../../ui/Hoja';
import { Icono, type NombreIcono } from '../../ui/Icono';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import type { Categoria } from '../../ui/categorias';
import { useNegocio } from '../negocio/contexto';
import { AbrirCaja } from '../caja/AbrirCaja';
import { FORMA_CORTA, fechaHora } from '../caja/comun';
import './PantallaInicio.css';

interface Acceso {
  id: IdSeccion;
  etiqueta: string;
  icono: NombreIcono;
  /** Basta con que el cargo pueda una de estas */
  acciones: readonly Accion[];
}

const ACCESOS: readonly Acceso[] = [
  { id: 'mesas', etiqueta: 'Mesas', icono: 'mesa', acciones: ['cuenta.atender', 'cuenta.sentar'] },
  { id: 'reservas', etiqueta: 'Reservas', icono: 'calendario', acciones: ['reserva.gestionar'] },
  { id: 'vender', etiqueta: 'Vender', icono: 'vender', acciones: ['venta.registrar'] },
  { id: 'caja', etiqueta: 'Caja', icono: 'caja', acciones: ['caja.abrir', 'caja.cerrar'] },
  { id: 'inventario', etiqueta: 'Inventario', icono: 'inventario', acciones: ['inventario.ver'] },
  { id: 'compras', etiqueta: 'Compras', icono: 'factura', acciones: ['compra.ver'] },
  { id: 'gastos', etiqueta: 'Gastos', icono: 'gasto', acciones: ['gasto.registrar', 'gasto.registrarDeCaja'] },
  { id: 'contabilidad', etiqueta: 'Contabilidad', icono: 'contabilidad', acciones: ['contabilidad.ver'] },
];

const COLOR_FORMA: Readonly<Record<(typeof FORMAS_PAGO)[number], Categoria>> = {
  efectivo: 'esmeralda',
  tarjeta: 'cielo',
  transferencia: 'indigo',
  cortesia: 'fucsia',
};

const MAX_ALERTAS = 5;

/** Inicio: saludo, estado de la caja, alertas de inventario y accesos según el cargo. */
export function PantallaInicio() {
  const { negocio, estado, sesion } = useNegocio();
  const avisos = negocio.puede('inventario.ver') ? alertas(estado) : [];
  const accesos = ACCESOS.filter((a) => a.acciones.some((x) => negocio.puede(x)));

  return (
    <Pagina ancho="amplio">
      <Encabezado titulo={`Hola, ${sesion?.nombre ?? ''}`} />
      {sesion && <p class="inicio__rol">{NOMBRE_ROL[sesion.rol]}</p>}
      <div class="inicio">
        {(negocio.puede('caja.abrir') || negocio.puede('venta.registrar')) && <TarjetaCaja />}
        {negocio.puede('reserva.gestionar') && <TarjetaReservas />}

        {negocio.puede('inventario.ver') && (
          <section class="inicio__bloque" aria-labelledby="inicio-alertas">
            <h2 id="inicio-alertas" class="inicio__titulo">
              Alertas de inventario
            </h2>
            {avisos.length === 0 ? (
              <p class="inicio__texto">Todo en orden: ningún producto está en negativo ni bajo el mínimo.</p>
            ) : (
              <>
                <ul class="inicio__alertas">
                  {avisos.slice(0, MAX_ALERTAS).map((a) => (
                    <li key={a.productoId} class="inicio__alerta">
                      <span class="inicio__nombre">{a.nombre}</span>
                      <span class="inicio__estado">
                        <Insignia tono={a.tipo === 'negativo' ? 'peligro' : 'aviso'} icono="alerta">
                          {a.tipo === 'negativo' ? 'Negativo' : 'Bajo mínimo'}
                        </Insignia>
                        <span class="cifras">
                          {mostrarCantidad(a.stock)}
                          {a.minimo !== null ? ` / mín. ${mostrarCantidad(a.minimo)}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <a class="boton boton--texto inicio__enlace" href="#/inventario">
                  <span class="boton__texto">
                    {avisos.length > MAX_ALERTAS ? `Ver las ${avisos.length} alertas en Inventario` : 'Ir a Inventario'}
                  </span>
                </a>
              </>
            )}
          </section>
        )}

        {accesos.length > 0 && (
          <nav class="inicio__bloque" aria-labelledby="inicio-accesos">
            <h2 id="inicio-accesos" class="inicio__titulo">
              Accesos rápidos
            </h2>
            <ul class="inicio__accesos">
              {accesos.map((a) => (
                <li key={a.id}>
                  <a class="inicio__acceso" href={`#/${a.id}`}>
                    <Icono nombre={a.icono} tamano={28} />
                    <span>{a.etiqueta}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </Pagina>
  );
}

function TarjetaCaja() {
  const { negocio } = useNegocio();
  const [abriendo, setAbriendo] = useState(false);
  const r = negocio.resumenCierre();

  return (
    <section class="inicio__bloque inicio__bloque--caja" aria-labelledby="inicio-caja">
      <div class="inicio__cabeza">
        <h2 id="inicio-caja" class="inicio__titulo">
          Caja
        </h2>
        <Insignia tono={r ? 'exito' : 'neutro'}>{r ? 'Abierta' : 'Cerrada'}</Insignia>
      </div>
      {!r ? (
        <>
          <p class="inicio__texto">Sin caja abierta no se puede vender. Ábrela con la base del día.</p>
          {negocio.puede('caja.abrir') && (
            <div class="inicio__acciones">
              <Boton variante="primario" icono="caja" alTocar={() => setAbriendo(true)}>
                Abrir caja
              </Boton>
            </div>
          )}
        </>
      ) : (
        <>
          <p class="inicio__texto">
            Abierta por {r.abiertaPor} · <span class="cifras">{fechaHora(r.abiertaEn)}</span> · base{' '}
            <span class="cifras">{pesos(r.base)}</span>
          </p>
          <Rejilla tipo="cifra" etiqueta="Ventas de la caja por forma de pago">
            <Cifra etiqueta="Efectivo esperado" valor={pesos(r.esperado)} icono="caja" color="esmeralda" detalle="en el cajón" />
            {FORMAS_PAGO.map((f) => (
              <Cifra key={f} etiqueta={`Ventas: ${FORMA_CORTA[f].toLowerCase()}`} valor={pesos(r.ventasPorForma[f])} color={COLOR_FORMA[f]} />
            ))}
          </Rejilla>
          <p class="inicio__texto">
            {r.ventas} {r.ventas === 1 ? 'venta' : 'ventas'} por <span class="cifras">{pesos(r.vendido)}</span>
            {r.anuladas > 0 ? ` · ${r.anuladas} anulada${r.anuladas === 1 ? '' : 's'}` : ''}
          </p>
          <div class="inicio__acciones">
            {negocio.puede('venta.registrar') && (
              <a class="boton boton--primario" href="#/vender">
                <Icono nombre="vender" tamano={20} />
                <span class="boton__texto">Ir a vender</span>
              </a>
            )}
            {negocio.puede('caja.cerrar') && (
              <a class="boton boton--contorno" href="#/caja/cerrar">
                <Icono nombre="candado" tamano={20} />
                <span class="boton__texto">Cerrar caja</span>
              </a>
            )}
          </div>
        </>
      )}
      {abriendo && (
        <Hoja titulo="Abrir caja" alCerrar={() => setAbriendo(false)}>
          <AbrirCaja alAbrir={() => setAbriendo(false)} />
        </Hoja>
      )}
    </section>
  );
}

/** Reservas de hoy: las pendientes por hora y cuántas están en tiempo de cancelación. */
function TarjetaReservas() {
  const { estado } = useNegocio();
  const ahora = new Date();
  const hoy = diaDe(ahora);
  const pendientes = Object.values(estado.reservas)
    .filter((r) => r.estado === 'pendiente' && r.fecha <= hoy)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const vencidas = pendientes.filter((r) => situacionReserva(r, ahora) === 'cancelable').length;
  return (
    <section class="inicio__bloque" aria-labelledby="inicio-reservas">
      <h2 id="inicio-reservas" class="inicio__titulo">
        Reservas de hoy
      </h2>
      {pendientes.length === 0 ? (
        <p class="inicio__texto">No hay reservas pendientes para hoy.</p>
      ) : (
        <ul class="inicio__alertas">
          {pendientes.slice(0, MAX_ALERTAS).map((r) => {
            const s = situacionReserva(r, ahora);
            return (
              <li key={r.id} class="inicio__alerta">
                <span class="inicio__nombre">
                  <span class="cifras">{r.hora}</span> · {nombreDe(estado, r.cliente)} ({r.personas})
                </span>
                <span class="inicio__estado">
                  <Insignia tono={s === 'cancelable' ? 'peligro' : s === 'esperando' ? 'aviso' : 'exito'}>
                    {s === 'cancelable' ? 'En tiempo de cancelación' : s === 'esperando' ? 'Esperando' : 'A tiempo'}
                  </Insignia>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {vencidas > 0 && (
        <p class="inicio__texto" role="status">
          <strong class="cifras">{vencidas}</strong> {vencidas === 1 ? 'reserva pasó' : 'reservas pasaron'} su tiempo de espera.
        </p>
      )}
      <a class="boton boton--texto inicio__enlace" href="#/reservas">
        Ver reservas
      </a>
    </section>
  );
}
