import { useState } from 'preact/hooks';
import { leerDinero } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { useNegocio } from '../negocio/contexto';
import { EntradaDinero, textoError, useOperacion } from './comun';

/**
 * Abrir caja: la base es el efectivo con que se empieza (NEGOCIO §4.1). Se escribe o se toca en
 * el teclado y «Abrir caja» la guarda. `alAbrir` avisa a quien la contiene (cerrar la hoja…).
 */
export function AbrirCaja({ alAbrir }: { alAbrir?: () => void }) {
  const { negocio } = useNegocio();
  const [base, setBase] = useState('');
  const { error, setError, ocupado, correr } = useOperacion();

  async function abrir() {
    let valor;
    try {
      valor = leerDinero(base === '' ? '0' : base);
    } catch (e) {
      setError(textoError(e));
      return;
    }
    if (await correr(() => negocio.abrirCaja(valor))) alAbrir?.();
  }

  return (
    <div class="abrir-caja">
      <EntradaDinero
        etiqueta="Base (efectivo con que empiezas)"
        valor={base}
        alCambiar={(v) => {
          setBase(v);
          setError(undefined);
        }}
        error={error}
        ayuda="Cuenta los billetes y monedas del cajón. Si empiezas sin plata, déjalo en blanco."
        alConfirmar={() => void abrir()}
        etiquetaConfirmar={ocupado ? 'Abriendo…' : 'Abrir caja'}
        confirmarDesactivado={ocupado}
      />
      {base === '' && (
        <Boton variante="texto" ancho desactivado={ocupado} alTocar={() => void abrir()}>
          Abrir sin base ($ 0)
        </Boton>
      )}
    </div>
  );
}
