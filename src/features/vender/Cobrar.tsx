import { useState } from 'preact/hooks';
import { centavos, FORMAS_PAGO, leerDinero, pesos, type Centavos, type FormaPago, type PagoPedido } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { CampoNumero } from '../../ui/CampoNumero';
import { Hoja } from '../../ui/Hoja';
import { Icono } from '../../ui/Icono';
import { useNegocio } from '../negocio/contexto';
import { dineroSeguro, EntradaDinero, FORMA_CORTA, textoError, useOperacion } from '../caja/comun';
import { descuentoDe, type Pedido } from './pedido';

interface Props {
  pedido: Pedido;
  /** Total de la vista previa (el que se guarda lo calcula el núcleo) */
  total: Centavos;
  alCerrar: () => void;
  /** La venta quedó registrada: total y cambio guardados por el núcleo */
  alVender: (resultado: { total: Centavos; cambio: Centavos | null }) => void;
}

interface Pago {
  forma: FormaPago;
  /** Texto del valor (todas menos la última, que paga «el resto») */
  monto: string;
}

const BILLETES = [10_000, 20_000, 50_000, 100_000].map((p) => centavos(p * 100));

/**
 * Cobrar: forma de pago con botones grandes, efectivo con «recibido» y cambio en grande, y pago
 * mixto (añadir otra forma: la última paga el resto). Confirmar → `negocio.vender`.
 */
export function Cobrar({ pedido, total, alCerrar, alVender }: Props) {
  const { negocio } = useNegocio();
  const [pagos, setPagos] = useState<Pago[]>([{ forma: 'efectivo', monto: '' }]);
  const [recibido, setRecibido] = useState('');
  const { error, setError, ocupado, correr } = useOperacion();
  const mixto = pagos.length > 1;
  const sinCobro = total === 0;

  // Vista previa de cuánto va en efectivo (para el cambio)
  const conMonto = pagos.slice(0, -1).reduce((s, p) => s + (dineroSeguro(p.monto) ?? 0), 0);
  const resto = centavos(Math.max(0, total - conMonto));
  const iEfectivo = pagos.findIndex((p) => p.forma === 'efectivo');
  const efectivo: Centavos | null =
    iEfectivo < 0 || sinCobro ? null : iEfectivo === pagos.length - 1 ? resto : dineroSeguro(pagos[iEfectivo]?.monto ?? '');
  const recibidoValor = dineroSeguro(recibido);
  const cambio = efectivo !== null && recibidoValor !== null && recibidoValor >= efectivo ? centavos(recibidoValor - efectivo) : null;
  const libres = FORMAS_PAGO.filter((f) => !pagos.some((p) => p.forma === f));

  function cambiar(i: number, cambio: Partial<Pago>) {
    setPagos((ps) => ps.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
    setError(undefined);
  }

  async function confirmar() {
    let datos: { pagos: PagoPedido[]; recibido: Centavos | null };
    let descuento;
    try {
      descuento = descuentoDe(pedido);
      datos = {
        pagos: pagos.map((p, i) => (i === pagos.length - 1 ? { forma: p.forma } : { forma: p.forma, monto: leerDinero(p.monto) })),
        recibido: efectivo !== null && recibido.trim() !== '' ? leerDinero(recibido) : null,
      };
    } catch (e) {
      setError(e instanceof RangeError ? e.message : textoError(e));
      return;
    }
    let guardado: { total: Centavos; cambio: Centavos | null } | null = null;
    const ok = await correr(async () => {
      const ev = await negocio.vender({
        lineas: pedido.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
        descuento,
        pagos: datos.pagos,
        recibido: datos.recibido,
      });
      if (ev.tipo === 'venta.registrada') guardado = { total: ev.datos.total, cambio: ev.datos.cambio ?? null };
    });
    if (ok) alVender(guardado ?? { total, cambio: null });
  }

  const pie = (
    <div class="cobrar__pie">
      {error && (
        <p class="cobrar__error" role="alert">
          {error}
        </p>
      )}
      <Boton variante="primario" ancho icono="check" desactivado={ocupado} alTocar={() => void confirmar()}>
        {ocupado ? 'Guardando…' : 'Confirmar venta'}
      </Boton>
    </div>
  );

  return (
    <Hoja titulo="Cobrar" alCerrar={alCerrar} pie={pie}>
      <div class="cobrar">
        <p class="cobrar__total">
          <span class="cobrar__etiqueta">Total a cobrar</span>
          <span class="cobrar__cifra cifras">{pesos(total)}</span>
        </p>

        {sinCobro ? (
          <p class="cobrar__nota">El total es $ 0: no hay nada que cobrar.</p>
        ) : !mixto ? (
          <div class="cobrar__formas" role="radiogroup" aria-label="Forma de pago">
            {FORMAS_PAGO.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={pagos[0]?.forma === f}
                class="cobrar__forma"
                onClick={() => {
                  cambiar(0, { forma: f });
                  if (f !== 'efectivo') setRecibido('');
                }}
              >
                {FORMA_CORTA[f]}
              </button>
            ))}
          </div>
        ) : (
          <ul class="cobrar__pagos" aria-label="Formas de pago">
            {pagos.map((p, i) => (
              <li key={p.forma} class="cobrar__pago">
                {i < pagos.length - 1 ? (
                  <CampoNumero etiqueta={`Valor en ${FORMA_CORTA[p.forma].toLowerCase()}`} valor={p.monto} prefijo="$" alCambiar={(monto) => cambiar(i, { monto })} />
                ) : (
                  <p class="cobrar__resto">
                    <span>{FORMA_CORTA[p.forma]}: el resto</span>
                    <span class="cifras">{pesos(resto)}</span>
                  </p>
                )}
                <button
                  type="button"
                  class="cobrar__quitar"
                  aria-label={`Quitar ${FORMA_CORTA[p.forma]}`}
                  onClick={() => {
                    setPagos((ps) => ps.filter((_, j) => j !== i).map((x, j, arr) => (j === arr.length - 1 ? { ...x, monto: '' } : x)));
                    if (p.forma === 'efectivo') setRecibido('');
                  }}
                >
                  <Icono nombre="cerrar" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!sinCobro && libres.length > 0 && (
          <div class="cobrar__mixto">
            <p class="cobrar__subtitulo">{mixto ? 'Añadir otra forma de pago' : 'Pago mixto: añadir otra forma'}</p>
            <div class="cobrar__libres">
              {libres.map((f) => (
                <Boton key={f} icono="mas-signo" alTocar={() => setPagos((ps) => [...ps, { forma: f, monto: '' }])}>
                  {FORMA_CORTA[f]}
                </Boton>
              ))}
            </div>
          </div>
        )}

        {efectivo !== null && (
          <section class="cobrar__efectivo" aria-label="Efectivo">
            <div class="cobrar__rapidos" role="group" aria-label="Montos rápidos">
              <Boton variante="tonal" alTocar={() => setRecibido(String(efectivo / 100))}>
                Exacto
              </Boton>
              {BILLETES.filter((b) => b >= efectivo).map((b) => (
                <Boton key={b} variante="tonal" alTocar={() => setRecibido(String(b / 100))}>
                  {pesos(b)}
                </Boton>
              ))}
            </div>
            <EntradaDinero
              etiqueta="Recibido en efectivo"
              valor={recibido}
              alCambiar={(v) => {
                setRecibido(v);
                setError(undefined);
              }}
              ayuda={`Efectivo a pagar: ${pesos(efectivo)}. Opcional: escribe lo que te dan y la app dice el cambio.`}
            />
            <p class={`cobrar__cambio${cambio === null ? ' cobrar__cambio--vacio' : ''}`} aria-live="polite">
              <span class="cobrar__etiqueta">Cambio</span>
              <span class="cobrar__cifra cifras">{cambio === null ? '—' : pesos(cambio)}</span>
            </p>
            {recibidoValor !== null && recibidoValor < efectivo && (
              <p class="cobrar__falta" role="status">
                Faltan {pesos(centavos(efectivo - recibidoValor))}.
              </p>
            )}
          </section>
        )}
        <p class="cobrar__nota">Comprobante interno: Bar Box no emite factura electrónica.</p>
      </div>
    </Hoja>
  );
}
