import { useState } from 'preact/hooks';
import { nombreDe, type RefCliente } from '../../core/negocio';
import { Boton } from '../../ui/Boton';
import { Buscador } from '../../ui/Buscador';
import { CampoTexto } from '../../ui/CampoTexto';
import { Chip, GrupoChips } from '../../ui/Chip';
import { Segmentado } from '../../ui/Segmentado';
import { textoError } from '../caja/comun';
import { useNegocio } from '../negocio/contexto';
import './reservas.css';

type Tipo = 'ninguno' | 'nombre' | 'cliente' | 'usuario';

const norma = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim();

interface Props {
  valor: RefCliente | null;
  alCambiar: (ref: RefCliente | null) => void;
  /** Ofrecer «Sin nombre» (la mesa con su nombre de siempre) */
  conNinguno?: boolean | undefined;
  /** Ofrecer a alguien del equipo (usuarios) */
  conUsuarios?: boolean | undefined;
}

/**
 * Elegir a quién: un cliente registrado (con buscador, y registrar uno nuevo ahí mismo), alguien
 * del equipo, un nombre escrito de momento o ninguno.
 */
export function ElegirCliente({ valor, alCambiar, conNinguno = false, conUsuarios = false }: Props) {
  const { negocio, estado } = useNegocio();
  const [tipo, setTipo] = useState<Tipo>(valor?.tipo ?? (conNinguno ? 'ninguno' : 'nombre'));
  const [escrito, setEscrito] = useState(valor?.tipo === 'nombre' ? valor.nombre : '');
  const [busqueda, setBusqueda] = useState('');
  const [nuevo, setNuevo] = useState<{ nombre: string; telefono: string } | null>(null);
  const [error, setError] = useState('');

  const opciones: { valor: Tipo; etiqueta: string }[] = [
    ...(conNinguno ? [{ valor: 'ninguno' as const, etiqueta: 'Sin nombre' }] : []),
    { valor: 'nombre', etiqueta: 'Nombre' },
    { valor: 'cliente', etiqueta: 'Cliente' },
    ...(conUsuarios ? [{ valor: 'usuario' as const, etiqueta: 'Equipo' }] : []),
  ];

  function cambiarTipo(t: Tipo) {
    setTipo(t);
    setError('');
    if (t === 'ninguno') alCambiar(null);
    else if (t === 'nombre') alCambiar(escrito.trim() ? { tipo: 'nombre', nombre: escrito } : null);
    else alCambiar(null);
  }

  const q = norma(busqueda);
  const clientes = Object.values(estado.clientes)
    .filter((c) => !q || norma(`${c.nombre} ${c.telefono ?? ''}`).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, 12);
  const usuarios = Object.values(estado.usuarios).filter((u) => u.activo);

  async function registrar() {
    if (!nuevo?.nombre.trim()) {
      setError('Escribe el nombre del cliente.');
      return;
    }
    try {
      const ev = await negocio.crearCliente({ nombre: nuevo.nombre, telefono: nuevo.telefono });
      alCambiar({ tipo: 'cliente', clienteId: ev.id });
      setNuevo(null);
      setError('');
    } catch (e) {
      setError(textoError(e));
    }
  }

  return (
    <div class="elegir-cliente">
      <Segmentado etiqueta="A nombre de" opciones={opciones} valor={tipo} alCambiar={cambiarTipo} />
      {tipo === 'ninguno' && <p class="elegir-cliente__pista">La mesa queda con su nombre de siempre.</p>}
      {tipo === 'nombre' && (
        <CampoTexto
          etiqueta="Nombre"
          valor={escrito}
          alCambiar={(v) => {
            setEscrito(v);
            alCambiar(v.trim() ? { tipo: 'nombre', nombre: v } : null);
          }}
          marcador="Ej.: Cumpleaños de Leo"
          ayuda="Solo por hoy: no queda registrado como cliente."
        />
      )}
      {tipo === 'cliente' && (
        <div class="elegir-cliente__clientes">
          <Buscador etiqueta="Buscar cliente" valor={busqueda} alCambiar={setBusqueda} marcador="Nombre o teléfono" />
          {clientes.length === 0 ? (
            <p class="elegir-cliente__pista">{Object.keys(estado.clientes).length === 0 ? 'Aún no hay clientes registrados.' : 'Ningún cliente coincide.'}</p>
          ) : (
            <ul class="elegir-cliente__lista" aria-label="Clientes">
              {clientes.map((c) => {
                const elegido = valor?.tipo === 'cliente' && valor.clienteId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      class={`elegir-cliente__opcion${elegido ? ' elegir-cliente__opcion--elegida' : ''}`}
                      aria-pressed={elegido}
                      onClick={() => alCambiar({ tipo: 'cliente', clienteId: c.id })}
                    >
                      <strong>{c.nombre}</strong>
                      {c.telefono && <span class="cifras">{c.telefono}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {negocio.puede('cliente.gestionar') &&
            (nuevo ? (
              <div class="elegir-cliente__nuevo">
                <CampoTexto etiqueta="Nombre del cliente" valor={nuevo.nombre} alCambiar={(nombre) => setNuevo({ ...nuevo, nombre })} />
                <CampoTexto etiqueta="Teléfono" tipo="tel" valor={nuevo.telefono} alCambiar={(telefono) => setNuevo({ ...nuevo, telefono })} marcador="Opcional" />
                <Boton variante="tonal" icono="check" alTocar={() => void registrar()}>
                  Registrar y elegir
                </Boton>
              </div>
            ) : (
              <Boton variante="texto" icono="mas-signo" alTocar={() => setNuevo({ nombre: busqueda.trim(), telefono: '' })}>
                Registrar cliente nuevo
              </Boton>
            ))}
        </div>
      )}
      {tipo === 'usuario' && (
        <GrupoChips etiqueta="Del equipo">
          {usuarios.map((u) => (
            <Chip
              key={u.id}
              seleccionado={valor?.tipo === 'usuario' && valor.usuarioId === u.id}
              alCambiar={() => alCambiar({ tipo: 'usuario', usuarioId: u.id })}
            >
              {u.nombre}
            </Chip>
          ))}
        </GrupoChips>
      )}
      {valor && tipo !== 'nombre' && (
        <p class="elegir-cliente__elegido" aria-live="polite">
          Elegido: <strong>{nombreDe(estado, valor)}</strong>
        </p>
      )}
      {error && (
        <p class="elegir-cliente__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
