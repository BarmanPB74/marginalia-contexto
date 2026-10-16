import { useState } from 'preact/hooks';
import { centavos, FORMAS_PAGO, leerDinero, pesos, type Centavos, type ResumenCierre } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Dialogo } from '../../ui/Dialogo';
import { Insignia } from '../../ui/Insignia';
import { useNegocio } from '../negocio/contexto';
import { EntradaDinero, FORMA_CORTA, textoError, useOperacion } from './comun';

type Paso = 'resumen' | 'contar' | 'diferencia';

const PASOS: Record<Paso, string> = { resumen: '1. Resumen', contar: '2. Contar efectivo', diferencia: '3. Diferencia y nota' };

/**
 * Cierre de caja en pasos (NEGOCIO §4.4): resumen del núcleo → contar el efectivo → diferencia
 * (sobrante o faltante) con nota → confirmar. El esperado que se vio en el resumen viaja como
 * `esperadoVisto`: si la caja se movió mientras tanto, el núcleo lo rechaza y hay que volver a contar.
 */
export function CerrarCaja({ alCancelar, alCerrar }: { alCancelar: () => void; alCerrar: () => void }) {
  const { negocio } = useNegocio();
  const [paso, setPaso] = useState<Paso>('resumen');
  const [visto, setVisto] = useState<ResumenCierre | null>(() => negocio.resumenCierre());
  const [texto, setTexto] = useState('');
  const [contado, setContado] = useState<Centavos | null>(null);
  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const { error, setError, ocupado, correr } = useOperacion();

  if (!visto) return <p>No hay caja abierta.</p>;
  const conDiferencia = contado !== null ? negocio.resumenCierre(contado) : null;
  const diferencia = conDiferencia?.diferencia ?? null;
  const pideNota = visto.sinMovimientos || (diferencia !== null && diferencia !== 0);

  function contar() {
    try {
      setContado(leerDinero(texto === '' ? '0' : texto));
      setPaso('diferencia');
      setError(undefined);
    } catch (e) {
      setError(textoError(e));
    }
  }

  function revisar() {
    if (pideNota && !nota.trim()) {
      setError(
        visto?.sinMovimientos
          ? 'Esta caja no tuvo movimientos: escribe el motivo del cierre.'
          : 'Hay diferencia: escribe una nota que la explique.',
      );
      return;
    }
    setError(undefined);
    setConfirmando(true);
  }

  async function cerrar() {
    if (contado === null || !visto) return;
    const v = visto;
    const ok = await correr(() => negocio.cerrarCaja({ contado, nota: nota.trim() || null, confirmar: true, esperadoVisto: v.esperado }));
    setConfirmando(false);
    if (ok) alCerrar();
  }

  function volverAlResumen() {
    setVisto(negocio.resumenCierre());
    setPaso('resumen');
    setError(undefined);
  }

  return (
    <section class="cierre" aria-label="Cerrar caja">
      <ol class="cierre__pasos" aria-label="Pasos del cierre">
        {(Object.keys(PASOS) as Paso[]).map((p) => (
          <li key={p} class="cierre__paso" aria-current={p === paso ? 'step' : undefined}>
            {PASOS[p]}
          </li>
        ))}
      </ol>

      {paso === 'resumen' && (
        <>
          <ResumenTabla r={visto} />
          <div class="cierre__acciones">
            <Boton variante="texto" alTocar={alCancelar}>
              Cancelar
            </Boton>
            <Boton variante="primario" icono="flecha" alTocar={() => setPaso('contar')}>
              Contar efectivo
            </Boton>
          </div>
        </>
      )}

      {paso === 'contar' && (
        <>
          <p class="cierre__explica">
            Cuenta los billetes y monedas del cajón y escribe el total. La app compara con el efectivo esperado
            (<span class="cifras">{pesos(visto.esperado)}</span>).
          </p>
          <div class="cierre__teclado">
            <EntradaDinero
              etiqueta="Efectivo contado"
              valor={texto}
              alCambiar={(v) => {
                setTexto(v);
                setError(undefined);
              }}
              error={error}
              alConfirmar={contar}
              etiquetaConfirmar="Ver diferencia"
            />
          </div>
          <div class="cierre__acciones">
            <Boton variante="texto" icono="atras" alTocar={volverAlResumen}>
              Volver
            </Boton>
            {texto === '' && (
              <Boton alTocar={contar}>No hay efectivo ($ 0)</Boton>
            )}
          </div>
        </>
      )}

      {paso === 'diferencia' && contado !== null && diferencia !== null && (
        <>
          <dl class="cierre__cuadre">
            <div>
              <dt>Efectivo esperado</dt>
              <dd class="cifras">{pesos(visto.esperado)}</dd>
            </div>
            <div>
              <dt>Efectivo contado</dt>
              <dd class="cifras">{pesos(contado)}</dd>
            </div>
          </dl>
          <Diferencia valor={diferencia} />
          <CampoTexto
            etiqueta={pideNota ? 'Nota (obligatoria)' : 'Nota (opcional)'}
            valor={nota}
            alCambiar={(v) => {
              setNota(v);
              setError(undefined);
            }}
            marcador={diferencia < 0 ? 'Ej.: se dio mal un cambio' : diferencia > 0 ? 'Ej.: propina sin registrar' : 'Ej.: todo en orden'}
            error={error}
          />
          <div class="cierre__acciones">
            <Boton variante="texto" icono="atras" alTocar={() => setPaso('contar')}>
              Volver a contar
            </Boton>
            <Boton variante="primario" icono="check" desactivado={ocupado} alTocar={revisar}>
              Cerrar caja
            </Boton>
          </div>
        </>
      )}

      {confirmando && contado !== null && diferencia !== null && (
        <Dialogo
          titulo="¿Cerrar la caja?"
          etiquetaConfirmar={ocupado ? 'Cerrando…' : 'Sí, cerrar caja'}
          alCerrar={() => setConfirmando(false)}
          alConfirmar={() => void cerrar()}
        >
          <p>
            Esperado <span class="cifras">{pesos(visto.esperado)}</span>, contado <span class="cifras">{pesos(contado)}</span>:{' '}
            {textoDiferencia(diferencia)}. El cierre queda firmado y no se puede cambiar.
          </p>
        </Dialogo>
      )}
    </section>
  );
}

export function textoDiferencia(d: Centavos): string {
  if (d === 0) return 'la caja cuadra';
  return d > 0 ? `sobran ${pesos(d)}` : `faltan ${pesos(centavos(Math.abs(d)))}`;
}

/** Diferencia destacada: verde si cuadra, ámbar si sobra, rojo si falta. */
export function Diferencia({ valor }: { valor: Centavos }) {
  const tipo = valor === 0 ? 'cuadra' : valor > 0 ? 'sobrante' : 'faltante';
  return (
    <p class={`cierre__diferencia cierre__diferencia--${tipo}`}>
      <Insignia tono={valor === 0 ? 'exito' : valor > 0 ? 'aviso' : 'peligro'} icono={valor === 0 ? 'check' : 'alerta'}>
        {valor === 0 ? 'Cuadra' : valor > 0 ? 'Sobrante' : 'Faltante'}
      </Insignia>
      <span class="cierre__cifra cifras">{pesos(valor)}</span>
    </p>
  );
}

/** El resumen del núcleo tal cual (`resumenCierre`): nada se suma aquí. */
export function ResumenTabla({ r }: { r: ResumenCierre }) {
  return (
    <dl class="cierre__resumen">
      <div>
        <dt>Base</dt>
        <dd class="cifras">{pesos(r.base)}</dd>
      </div>
      {FORMAS_PAGO.map((f) => (
        <div key={f}>
          <dt>Ventas en {FORMA_CORTA[f].toLowerCase()}</dt>
          <dd class="cifras">{pesos(r.ventasPorForma[f])}</dd>
        </div>
      ))}
      <div class="cierre__resumen-total">
        <dt>
          Vendido ({r.ventas} {r.ventas === 1 ? 'venta' : 'ventas'}
          {r.anuladas > 0 ? `, ${r.anuladas} anulada${r.anuladas === 1 ? '' : 's'}` : ''})
        </dt>
        <dd class="cifras">{pesos(r.vendido)}</dd>
      </div>
      <div>
        <dt>Entradas</dt>
        <dd class="cifras">{pesos(r.ingresos)}</dd>
      </div>
      <div>
        <dt>Retiros</dt>
        <dd class="cifras">−{pesos(r.retiros)}</dd>
      </div>
      <div>
        <dt>Gastos desde la caja</dt>
        <dd class="cifras">−{pesos(r.gastos)}</dd>
      </div>
      <div>
        <dt>Pagos a proveedores desde la caja</dt>
        <dd class="cifras">−{pesos(r.pagos)}</dd>
      </div>
      <div class="cierre__resumen-esperado">
        <dt>Efectivo esperado en el cajón</dt>
        <dd class="cifras">{pesos(r.esperado)}</dd>
      </div>
    </dl>
  );
}
