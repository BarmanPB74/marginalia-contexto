import { Icono } from './Icono';
import './TecladoNumerico.css';

interface Props {
  /** Texto actual (lo muestra quien usa el teclado; aquí solo se le añaden o quitan caracteres) */
  valor: string;
  alCambiar: (valor: string) => void;
  /** Tecla de la esquina inferior izquierda: "000" (pesos), "00" o "," (decimales) */
  extra?: string | undefined;
  /** Máximo de caracteres */
  maximo?: number | undefined;
  alConfirmar?: (() => void) | undefined;
  etiquetaConfirmar?: string | undefined;
  confirmarDesactivado?: boolean | undefined;
  /** Nombre del grupo para lectores de pantalla */
  etiqueta?: string | undefined;
}

const DIGITOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Teclado numérico grande para cobrar en caja. No convierte nada: entrega el texto y el núcleo
 * lo valida. Evita solo lo evidente (dos comas, ceros a la izquierda, pasar del máximo).
 */
export function TecladoNumerico({
  valor,
  alCambiar,
  extra = '000',
  maximo = 12,
  alConfirmar,
  etiquetaConfirmar = 'Cobrar',
  confirmarDesactivado = false,
  etiqueta = 'Teclado numérico',
}: Props) {
  const escribir = (t: string) => {
    if (t === ',' && (valor.includes(',') || valor === '')) return alCambiar(valor === '' ? '0,' : valor);
    const nuevo = valor === '0' && t !== ',' ? t : valor + t;
    if (nuevo.length > maximo || /^0{2,}/.test(nuevo)) return;
    alCambiar(nuevo);
  };
  const teclas = [...DIGITOS, extra, '0'];
  return (
    <div class="teclado-numerico" role="group" aria-label={etiqueta}>
      <div class="teclado-numerico__rejilla">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            class="teclado-numerico__tecla cifras"
            disabled={t === extra && valor === '' && t !== ','}
            onClick={() => escribir(t)}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          class="teclado-numerico__tecla teclado-numerico__tecla--borrar"
          aria-label="Borrar"
          disabled={valor === ''}
          onClick={() => alCambiar(valor.slice(0, -1))}
        >
          <Icono nombre="retroceso" tamano={28} />
        </button>
      </div>
      {alConfirmar && (
        <button
          type="button"
          class="teclado-numerico__confirmar"
          disabled={confirmarDesactivado || valor === ''}
          onClick={alConfirmar}
        >
          {etiquetaConfirmar}
        </button>
      )}
    </div>
  );
}
