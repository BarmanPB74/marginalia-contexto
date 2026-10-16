import { useState } from 'preact/hooks';
import { ReglaRota, type Negocio } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import './Contabilidad.css';

type Resultado = { ok: true; texto: string } | { ok: false; texto: string; explicacion: string };

/** Recorre el diario y comprueba la cadena de hashes. Devuelve lo que se le dice a la persona. */
export async function verificarRegistro(negocio: Negocio): Promise<Resultado> {
  try {
    const v = await negocio.verificar();
    if (v.ok) {
      return { ok: true, texto: `Registro íntegro: ${v.eventos} ${v.eventos === 1 ? 'movimiento' : 'movimientos'}.` };
    }
    return {
      ok: false,
      texto: `El registro no cuadra en el movimiento ${v.indice + 1} de ${v.archivo}: ${v.motivo}`,
      explicacion:
        'Cada movimiento guarda la huella del anterior. Si no cuadra, un archivo se dañó o alguien lo cambió por ' +
        'fuera de la app. No borres nada: saca una copia y revisa con quien te ayuda con Bar Box.',
    };
  } catch (e) {
    return {
      ok: false,
      texto: e instanceof ReglaRota ? e.message : 'No se pudo leer el registro.',
      explicacion: 'Vuelve a intentarlo. Si sigue igual, saca una copia antes de tocar nada.',
    };
  }
}

/** Botón «Verificar registro» con su resultado (Contabilidad y Ajustes). */
export function VerificarRegistro({ negocio }: { negocio: Negocio }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <div class="verificar">
      <Boton
        icono="check"
        desactivado={ocupado}
        alTocar={() => {
          setOcupado(true);
          setResultado(null);
          void verificarRegistro(negocio).then((r) => {
            setResultado(r);
            setOcupado(false);
          });
        }}
      >
        {ocupado ? 'Verificando…' : 'Verificar registro'}
      </Boton>
      <div aria-live="polite">
        {resultado && (
          <div class={`verificar__resultado verificar__resultado--${resultado.ok ? 'ok' : 'mal'}`} role={resultado.ok ? 'status' : 'alert'}>
            <p class="verificar__texto">{resultado.texto}</p>
            {!resultado.ok && <p class="verificar__explicacion">{resultado.explicacion}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
