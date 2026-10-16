import { useState } from 'preact/hooks';
import { ACCIONES, NOMBRE_ACCION, NOMBRE_ROL, PERMISOS, ReglaRota, ROLES, type Rol } from '../../core/negocio';
import { Avatar } from '../../ui/Avatar';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Dialogo } from '../../ui/Dialogo';
import { Encabezado } from '../../ui/Encabezado';
import { Hoja } from '../../ui/Hoja';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Segmentado } from '../../ui/Segmentado';
import { useNegocio } from '../negocio/contexto';
import { LARGO_PIN } from '../sesion/Sesion';
import { PedirPin } from './PedirPin';
import './Usuarios.css';

/** Lo que se puede mostrar de una persona (nunca su PIN guardado). */
interface Persona {
  id: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

/** Qué puede hacer un cargo, en palabras, leído de la tabla única de permisos. */
export function quePuede(rol: Rol): string {
  const acciones = ACCIONES.filter((a) => PERMISOS[a].includes(rol));
  if (acciones.length === ACCIONES.length) return 'Puede hacer todo: precios y costos, usuarios, anular ventas, contabilidad y pagos.';
  const lista = acciones.filter((a) => a !== 'usuario.cambiarPinPropio').map((a) => NOMBRE_ACCION[a]);
  return `Puede ${lista.join(', ')}.`;
}

/** Texto del error para la persona (las reglas del núcleo ya vienen en español). */
function mensaje(e: unknown): string {
  return e instanceof ReglaRota ? e.message : 'No se pudo guardar. Prueba otra vez.';
}

/** Cerrar la sesión: la app vuelve sola a «¿Quién eres?». Al entrar de nuevo se abre Inicio. */
export function cambiarDeUsuario(cerrar: () => void) {
  location.hash = '#/inicio';
  cerrar();
}

type Hojas = { tipo: 'crear' } | { tipo: 'pin'; persona: Persona } | { tipo: 'desactivar'; persona: Persona } | null;

/**
 * Usuarios: el dueño ve y administra a todas las personas; cualquier cargo ve «Mi cuenta»
 * (cambiar su PIN y cambiar de usuario). Las reglas (p. ej. no desactivar al último dueño) las
 * pone el núcleo: aquí solo se muestra su mensaje.
 */
export function PantallaUsuarios() {
  const { negocio, estado, sesion } = useNegocio();
  const [abierta, setAbierta] = useState<Hojas>(null);
  const [aviso, setAviso] = useState('');
  const esDueno = negocio.puede('usuario.crear');
  if (!sesion) return null;

  const personas: Persona[] = Object.values(estado.usuarios)
    .map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo }))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es'));
  const cerrarHoja = () => setAbierta(null);

  async function desactivar(p: Persona) {
    try {
      await negocio.desactivarUsuario(p.id);
      setAviso(`«${p.nombre}» ya no puede entrar. Sus movimientos siguen en el registro.`);
    } catch (e) {
      setAviso(mensaje(e));
    }
    setAbierta(null);
  }

  return (
    <Pagina>
      <Encabezado
        titulo={esDueno ? 'Usuarios' : 'Mi cuenta'}
        {...(esDueno ? { accion: { etiqueta: 'Nueva persona', alTocar: () => setAbierta({ tipo: 'crear' }) } } : {})}
      />

      <section class="usuarios__seccion" aria-labelledby="mi-cuenta">
        <h2 id="mi-cuenta" class="usuarios__titulo">
          Mi cuenta
        </h2>
        <div class="usuarios__yo">
          <Avatar nombre={sesion.nombre} tamano="l" />
          <div class="usuarios__datos">
            <p class="usuarios__nombre">{sesion.nombre}</p>
            <p class="usuarios__rol">{NOMBRE_ROL[sesion.rol]}</p>
          </div>
        </div>
        <div class="usuarios__botones">
          <Boton icono="candado" alTocar={() => setAbierta({ tipo: 'pin', persona: sesion })}>
            Cambiar mi PIN
          </Boton>
          <Boton icono="usuarios" variante="tonal" alTocar={() => cambiarDeUsuario(() => negocio.cerrarSesion())}>
            Cerrar sesión / Cambiar de usuario
          </Boton>
        </div>
      </section>

      <div aria-live="polite">
        {aviso && (
          <p class="usuarios__aviso">
            {aviso}
          </p>
        )}
      </div>

      {esDueno && (
        <section class="usuarios__seccion" aria-labelledby="personas">
          <h2 id="personas" class="usuarios__titulo">
            Personas
          </h2>
          <ul class="usuarios__lista">
            {personas.map((p) => (
              <li key={p.id} class={`usuarios__fila${p.activo ? '' : ' usuarios__fila--inactiva'}`}>
                <Avatar nombre={p.nombre} />
                <div class="usuarios__datos">
                  <p class="usuarios__nombre">
                    {p.nombre}
                    {p.id === sesion.id && <span class="usuarios__tu"> (tú)</span>}
                  </p>
                  <p class="usuarios__rol">
                    {NOMBRE_ROL[p.rol]}{' '}
                    <Insignia tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Desactivado'}</Insignia>
                  </p>
                </div>
                {p.activo && (
                  <div class="usuarios__acciones">
                    <Boton variante="texto" etiqueta={`Cambiar el PIN de ${p.nombre}`} alTocar={() => setAbierta({ tipo: 'pin', persona: p })}>
                      Cambiar PIN
                    </Boton>
                    <Boton variante="texto" etiqueta={`Desactivar a ${p.nombre}`} alTocar={() => setAbierta({ tipo: 'desactivar', persona: p })}>
                      Desactivar
                    </Boton>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p class="usuarios__pista">
            Nadie se borra: una persona desactivada ya no entra, pero lo que hizo sigue firmado en el registro.
          </p>
        </section>
      )}

      {abierta?.tipo === 'crear' && (
        <CrearPersona
          alCerrar={cerrarHoja}
          alCrear={(nombre) => {
            setAviso(`Listo: «${nombre}» ya puede entrar con su PIN.`);
            cerrarHoja();
          }}
        />
      )}
      {abierta?.tipo === 'pin' && (
        <Hoja titulo={abierta.persona.id === sesion.id ? 'Cambiar mi PIN' : `PIN de ${abierta.persona.nombre}`} alCerrar={cerrarHoja}>
          <PedirPin
            conActual={abierta.persona.id === sesion.id}
            etiquetaNuevo={`PIN nuevo de ${LARGO_PIN} dígitos`}
            alVolver={cerrarHoja}
            alTerminar={async ({ actual, nuevo }) => {
              try {
                await negocio.cambiarPin(abierta.persona.id, nuevo, actual);
              } catch (e) {
                return mensaje(e);
              }
              setAviso(abierta.persona.id === sesion.id ? 'Tu PIN cambió.' : `El PIN de «${abierta.persona.nombre}» cambió.`);
              cerrarHoja();
              return undefined;
            }}
          />
        </Hoja>
      )}
      {abierta?.tipo === 'desactivar' && (
        <Dialogo
          titulo={`¿Desactivar a ${abierta.persona.nombre}?`}
          peligro
          etiquetaConfirmar="Desactivar"
          alCerrar={cerrarHoja}
          alConfirmar={() => void desactivar(abierta.persona)}
        >
          <p>
            No podrá volver a entrar. Lo que hizo queda en el registro con su nombre.
            {abierta.persona.id === sesion.id && ' Eres tú: tu sesión se cerrará.'}
          </p>
        </Dialogo>
      )}
    </Pagina>
  );
}

const OPCIONES_ROL = ROLES.map((r) => ({ valor: r, etiqueta: NOMBRE_ROL[r] }));

/** Nueva persona: nombre y cargo; luego su PIN dos veces. */
function CrearPersona({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (nombre: string) => void }) {
  const { negocio } = useNegocio();
  const [paso, setPaso] = useState<'datos' | 'pin'>('datos');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('cajero');
  const [error, setError] = useState<string | undefined>();
  const limpio = nombre.trim();

  return (
    <Hoja titulo="Nueva persona" alCerrar={alCerrar}>
      {paso === 'datos' ? (
        <form
          class="usuarios__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (limpio) setPaso('pin');
            else setError('Escribe el nombre.');
          }}
        >
          <CampoTexto etiqueta="Nombre" valor={nombre} alCambiar={(v) => {
              setNombre(v);
              setError(undefined);
            }} marcador="Ej.: Carlos" error={error} />
          <div>
            <p class="usuarios__etiqueta" aria-hidden="true">
              Cargo
            </p>
            <Segmentado etiqueta="Cargo" opciones={OPCIONES_ROL} valor={rol} alCambiar={setRol} />
            <p class="usuarios__permisos" aria-live="polite">
              <strong>{NOMBRE_ROL[rol]}:</strong> {quePuede(rol)}
            </p>
          </div>
          <Boton variante="primario" tipo="submit" ancho>
            Seguir: crear su PIN
          </Boton>
        </form>
      ) : (
        <PedirPin
          etiquetaNuevo={`PIN de ${limpio} (${LARGO_PIN} dígitos)`}
          alVolver={() => setPaso('datos')}
          alTerminar={async ({ nuevo }) => {
            try {
              await negocio.crearUsuario({ nombre: limpio, rol, pin: nuevo });
            } catch (e) {
              return mensaje(e);
            }
            alCrear(limpio);
            return undefined;
          }}
        />
      )}
    </Hoja>
  );
}
