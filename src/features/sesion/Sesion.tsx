import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { NOMBRE_ROL, ReglaRota, type UsuarioPublico } from '../../core/negocio';
import { BotonUsuario } from '../../ui/Avatar';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { TecladoPin } from '../../ui/TecladoPin';
import { useNegocio } from '../negocio/contexto';
import { restaurarDesdeArchivo } from '../negocio/copia';
import { elegirZip } from '../notas/copia';
import './Sesion.css';

/** En Stark el PIN de cada persona tiene 4 dígitos: rápido en la caja y con teclado grande. */
export const LARGO_PIN = 4;

/**
 * Puerta de la app (ADR-015): sin dueño creado → primer uso; sin sesión → elegir persona y PIN.
 * Con sesión, muestra la app. Nada del negocio se monta antes.
 */
export function Sesion({ children }: { children: ComponentChildren }) {
  const { negocio, sesion } = useNegocio();
  if (negocio.primerUso) return <PrimerUso />;
  if (!sesion) return <Entrar />;
  return <>{children}</>;
}

function Marco({ titulo, pista, children }: { titulo: string; pista?: string; children: ComponentChildren }) {
  return (
    <main class="sesion">
      <div class="sesion__tarjeta">
        <p class="sesion__marca">Stark</p>
        <h1 class="sesion__titulo">{titulo}</h1>
        {pista && <p class="sesion__pista">{pista}</p>}
        {children}
      </div>
    </main>
  );
}

/** Primer uso: el nombre del dueño y su PIN dos veces. */
function PrimerUso() {
  const { negocio } = useNegocio();
  const [paso, setPaso] = useState<'nombre' | 'pin' | 'repetir'>('nombre');
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [primero, setPrimero] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  /** Teléfono nuevo: traer la copia ZIP del negocio en vez de empezar de cero. */
  async function restaurar() {
    const archivo = await elegirZip();
    if (!archivo) return;
    const mensaje = await restaurarDesdeArchivo(archivo);
    setAviso(mensaje);
    if (mensaje.startsWith('Copia restaurada')) setTimeout(() => location.reload(), 1500);
  }

  async function crear(repetido: string) {
    if (repetido !== primero) {
      setError('No coinciden. Escríbelo otra vez.');
      setPin('');
      setPrimero('');
      setPaso('pin');
      return;
    }
    setOcupado(true);
    try {
      await negocio.crearUsuario({ nombre: nombre.trim(), rol: 'dueno', pin: repetido });
    } catch (e) {
      setError(e instanceof ReglaRota ? e.message : 'No se pudo crear. Prueba otra vez.');
      setPin('');
      setPaso('pin');
    } finally {
      setOcupado(false);
    }
  }

  if (paso === 'nombre') {
    return (
      <Marco titulo="Bienvenido" pista="Crea la cuenta del dueño. Después podrás añadir cajeros y bodega, cada uno con su PIN.">
        <form
          class="sesion__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (nombre.trim()) setPaso('pin');
          }}
        >
          <CampoTexto etiqueta="Tu nombre" valor={nombre} alCambiar={setNombre} marcador="Ej.: Pablo" />
          <Boton variante="primario" ancho desactivado={!nombre.trim()} alTocar={() => setPaso('pin')}>
            Seguir
          </Boton>
        </form>
        <Boton variante="texto" icono="importar" alTocar={() => void restaurar()}>
          Restaurar una copia del negocio
        </Boton>
        {aviso && (
          <p class="sesion__pista" role="alert">
            {aviso}
          </p>
        )}
      </Marco>
    );
  }
  return (
    <Marco titulo={`Hola, ${nombre.trim()}`} pista="Tu PIN protege las ventas, los costos y la contabilidad. No lo compartas.">
      <TecladoPin
        valor={pin}
        alCambiar={(v) => {
          setPin(v);
          setError(undefined);
        }}
        longitud={LARGO_PIN}
        etiqueta={paso === 'pin' ? `Crea tu PIN de ${LARGO_PIN} dígitos` : 'Repite tu PIN'}
        error={error}
        desactivado={ocupado}
        accion={{ etiqueta: 'Volver', icono: 'atras', alTocar: () => setPaso('nombre') }}
        alCompletar={(v) => {
          if (paso === 'pin') {
            setPrimero(v);
            setPin('');
            setPaso('repetir');
          } else void crear(v);
        }}
      />
    </Marco>
  );
}

/** Elegir quién entra y su PIN. Tras varios errores, espera creciente (lo decide el núcleo). */
function Entrar() {
  const { negocio } = useNegocio();
  const activos = negocio.usuarios().filter((u) => u.activo);
  const [elegido, setElegido] = useState<UsuarioPublico | null>(activos.length === 1 ? (activos[0] ?? null) : null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [esperaHasta, setEsperaHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (esperaHasta <= Date.now()) return;
    const reloj = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(reloj);
  }, [esperaHasta]);
  const segundos = Math.max(0, Math.ceil((esperaHasta - ahora) / 1000));

  async function probar(valor: string) {
    if (!elegido) return;
    setOcupado(true);
    const r = await negocio.iniciarSesion(elegido.id, valor);
    setOcupado(false);
    setPin('');
    if (r.ok) return;
    setError(r.mensaje);
    if (r.esperaMs) {
      setEsperaHasta(Date.now() + r.esperaMs);
      setAhora(Date.now());
    }
  }

  if (!elegido) {
    return (
      <Marco titulo="¿Quién eres?" pista="Toca tu nombre para entrar.">
        <div class="sesion__usuarios">
          {activos.map((u) => (
            <BotonUsuario key={u.id} nombre={u.nombre} rol={NOMBRE_ROL[u.rol]} alTocar={() => setElegido(u)} />
          ))}
        </div>
      </Marco>
    );
  }
  return (
    <Marco titulo={elegido.nombre} pista={NOMBRE_ROL[elegido.rol]}>
      <TecladoPin
        valor={pin}
        alCambiar={(v) => {
          setPin(v);
          setError(undefined);
        }}
        longitud={LARGO_PIN}
        error={segundos > 0 ? `Demasiados intentos. Espera ${segundos} s.` : error}
        desactivado={ocupado || segundos > 0}
        accion={
          activos.length > 1
            ? { etiqueta: 'Cambiar de persona', icono: 'usuarios', alTocar: () => setElegido(null) }
            : undefined
        }
        alCompletar={(v) => void probar(v)}
      />
    </Marco>
  );
}
