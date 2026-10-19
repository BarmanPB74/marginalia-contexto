import { useEffect, useState } from 'preact/hooks';
import {
  cuentaDeMesa,
  esHora,
  LIMITES,
  nombreDe,
  situacionReserva,
  type Cliente,
  type RefCliente,
  type Reserva,
  type SituacionReserva,
} from '../../core/negocio';
import { diaDe } from '../../core/notas/fechas';
import { Boton } from '../../ui/Boton';
import { BotonFlotante } from '../../ui/BotonFlotante';
import { Buscador } from '../../ui/Buscador';
import { CampoNumero } from '../../ui/CampoNumero';
import { CampoTexto } from '../../ui/CampoTexto';
import { Casilla } from '../../ui/Casilla';
import { Chip, GrupoChips } from '../../ui/Chip';
import { Encabezado } from '../../ui/Encabezado';
import { EstadoVacio } from '../../ui/EstadoVacio';
import { Hoja } from '../../ui/Hoja';
import { Icono } from '../../ui/Icono';
import { Insignia } from '../../ui/Insignia';
import { Pagina } from '../../ui/Pagina';
import { Pestanas } from '../../ui/Pestanas';
import { Segmentado } from '../../ui/Segmentado';
import { SelectorFecha } from '../../ui/SelectorFecha';
import { useEstado } from '../../app/estado';
import { useOperacion } from '../caja/comun';
import { useNegocio } from '../negocio/contexto';
import { ElegirCliente } from './ElegirCliente';
import '../vender/PantallaVender.css';
import '../mesas/PantallaMesas.css';
import './reservas.css';

/**
 * Reservas (recepción, NEGOCIO §4.6): las del día con su situación (a tiempo, esperando,
 * en tiempo de cancelación), llamadas de confirmación (contestó / no contestó), demora avisada,
 * llegó (y sentarla en su mesa), no llegó y cancelar. Al crear una, quien la toma le dice al
 * cliente el tiempo de espera: la app lo recuerda y lo exige. Pestaña aparte: clientes.
 */
export function PantallaReservas() {
  const { negocio, estado } = useNegocio();
  const [pestana, setPestana] = useState<'reservas' | 'clientes'>('reservas');
  if (!negocio.puede('reserva.gestionar')) {
    return (
      <Pagina ancho="amplio">
        <Encabezado titulo="Reservas" />
        <EstadoVacio mensaje="Tu cargo no maneja reservas." pista="Las reservas son de recepción, caja y el dueño." />
      </Pagina>
    );
  }
  return (
    <Pagina ancho="amplio">
      <Encabezado titulo="Reservas" />
      <Pestanas
        etiqueta="Reservas y clientes"
        pestanas={[
          { id: 'reservas', etiqueta: 'Reservas', contador: Object.values(estado.reservas).filter((r) => r.estado === 'pendiente').length },
          { id: 'clientes', etiqueta: 'Clientes', contador: Object.keys(estado.clientes).length },
        ]}
        actual={pestana}
        alCambiar={setPestana}
      >
        {pestana === 'reservas' ? <ListaReservas /> : <ListaClientes />}
      </Pestanas>
    </Pagina>
  );
}

// --- Utilidades -----------------------------------------------------------------------

/** Reloj que avanza cada 30 s (la situación de una reserva cambia con la hora). */
function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

/** «20», «8:30», «2030», «8 pm», «8:15 p. m.» → 'HH:MM'. Lanza RangeError si no se entiende. */
export function leerHora(texto: string): string {
  const t = texto.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '');
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a m|p m)?$/.exec(t);
  if (!m) throw new RangeError('Hora: escríbela como 20:00 (o 8:00 pm).');
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  const sufijo = m[3]?.replace(' ', '');
  if (sufijo) {
    if (h < 1 || h > 12) throw new RangeError('Hora: con am/pm va de 1 a 12.');
    h = (h % 12) + (sufijo === 'pm' ? 12 : 0);
  }
  const r = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  if (!esHora(r)) throw new RangeError('Hora: de 00:00 a 23:59.');
  return r;
}

/** Suma minutos a 'HH:MM' (puede pasar de medianoche: se muestra la hora del reloj). */
function masMinutos(hora: string, minutos: number): string {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  const total = (h * 60 + m + minutos) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function sumarDias(dia: string, n: number): string {
  const [a = 0, m = 1, d = 1] = dia.split('-').map(Number);
  return diaDe(new Date(a, m - 1, d + n));
}

function fechaLarga(dia: string): string {
  const [a = 0, m = 1, d = 1] = dia.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

const NOMBRE_SITUACION: Readonly<Record<SituacionReserva, string>> = {
  aTiempo: 'A tiempo',
  esperando: 'Esperando',
  cancelable: 'En tiempo de cancelación',
};

const NOMBRE_CERRADA: Readonly<Record<Exclude<Reserva['estado'], 'pendiente'>, string>> = {
  llego: 'Llegó',
  noLlego: 'No llegó',
  cancelada: 'Cancelada',
};

/** Texto del recordatorio que se le dice al cliente al reservar. */
export function recordatorio(hora: string, tolerancia: number): string {
  return `Si no llega a las ${masMinutos(hora, tolerancia)} (${tolerancia} min después de las ${hora}), la reserva se puede cancelar.`;
}

// --- Lista de reservas --------------------------------------------------------------

type Vista = 'hoy' | 'manana' | 'proximas';

function ListaReservas() {
  const { negocio, estado } = useNegocio();
  const ahora = useAhora();
  const [vista, setVista] = useState<Vista>('hoy');
  const [nueva, setNueva] = useState(false);
  const hoy = diaDe(ahora);
  const manana = sumarDias(hoy, 1);
  const todas = Object.values(estado.reservas);
  const lista = todas
    .filter((r) => (vista === 'hoy' ? r.fecha === hoy : vista === 'manana' ? r.fecha === manana : r.fecha > manana && r.estado === 'pendiente'))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora) || a.creadaEn.localeCompare(b.creadaEn));
  const vencidas = todas.filter((r) => r.estado === 'pendiente' && situacionReserva(r, ahora) === 'cancelable');

  return (
    <div class="reservas">
      {vencidas.length > 0 && (
        <p class="reservas__aviso" role="status">
          <Icono nombre="alerta" />
          {vencidas.length === 1 && vencidas[0]
            ? `${nombreDe(estado, vencidas[0].cliente)} pasó su tiempo de espera: la reserva está en tiempo de cancelación.`
            : `${vencidas.length} reservas pasaron su tiempo de espera: están en tiempo de cancelación.`}
        </p>
      )}
      <Segmentado
        etiqueta="Qué reservas ver"
        opciones={[
          { valor: 'hoy', etiqueta: 'Hoy' },
          { valor: 'manana', etiqueta: 'Mañana' },
          { valor: 'proximas', etiqueta: 'Próximas' },
        ]}
        valor={vista}
        alCambiar={setVista}
      />
      {lista.length === 0 ? (
        <EstadoVacio
          mensaje={vista === 'hoy' ? 'No hay reservas para hoy.' : vista === 'manana' ? 'No hay reservas para mañana.' : 'No hay reservas más adelante.'}
          pista="Toca «Nueva reserva» para anotar una."
        />
      ) : (
        <ul class="reservas__lista" aria-label="Reservas">
          {lista.map((r) => (
            <li key={r.id}>
              <TarjetaReserva reserva={r} ahora={ahora} conFecha={vista === 'proximas'} />
            </li>
          ))}
        </ul>
      )}
      <div class="inv-espacio-flotante" aria-hidden="true" />
      {negocio.puede('reserva.gestionar') && <BotonFlotante etiqueta="Nueva reserva" extendido alTocar={() => setNueva(true)} />}
      {nueva && <NuevaReserva hoy={hoy} alCerrar={() => setNueva(false)} />}
    </div>
  );
}

type Abierta = 'demora' | 'llego' | 'cancelar' | null;

function TarjetaReserva({ reserva: r, ahora, conFecha }: { reserva: Reserva; ahora: Date; conFecha: boolean }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const [abierta, setAbierta] = useState<Abierta>(null);
  const { error, correr, ocupado } = useOperacion();
  const pendiente = r.estado === 'pendiente';
  const situacion = pendiente ? situacionReserva(r, ahora) : null;
  const mesa = r.mesaId ? estado.mesas[r.mesaId] : null;
  const nombre = nombreDe(estado, r.cliente);
  const telefono = r.telefono ?? (r.cliente.tipo === 'cliente' ? estado.clientes[r.cliente.clienteId]?.telefono : null) ?? null;
  const limite = masMinutos(r.hora, r.demora + r.tolerancia);
  const clase = !pendiente ? 'reserva--cerrada' : situacion === 'cancelable' ? 'reserva--cancelable' : situacion === 'esperando' ? 'reserva--esperando' : '';

  const hacer = (f: () => Promise<unknown>, aviso: string) => void correr(f).then((ok) => ok && avisar(aviso));

  return (
    <article class={`reserva ${clase}`} aria-label={`Reserva de ${nombre} a las ${r.hora}`}>
      <div class="reserva__cabeza">
        <span class="reserva__hora cifras">
          {r.hora}
          {r.demora > 0 && <span class="reserva__datos"> → {masMinutos(r.hora, r.demora)}</span>}
        </span>
        {conFecha && <span class="reserva__datos">{fechaLarga(r.fecha)}</span>}
      </div>
      <p class="reserva__nombre">{nombre}</p>
      <p class="reserva__datos">
        <span>{r.personas === 1 ? '1 persona' : `${r.personas} personas`}</span>
        <span>{mesa ? mesa.nombre : 'Sin mesa'}</span>
        {telefono && <span class="cifras">{telefono}</span>}
        {pendiente && <span>Cancelable desde las {limite}</span>}
      </p>
      {r.nota && <p class="reserva__nota">{r.nota}</p>}
      <div class="reserva__insignias">
        {situacion && (
          <Insignia tono={situacion === 'cancelable' ? 'peligro' : situacion === 'esperando' ? 'aviso' : 'exito'}>{NOMBRE_SITUACION[situacion]}</Insignia>
        )}
        {!pendiente && <Insignia tono={r.estado === 'llego' ? 'exito' : 'neutro'}>{NOMBRE_CERRADA[r.estado as Exclude<Reserva['estado'], 'pendiente'>]}</Insignia>}
        {r.llamada && <Insignia tono={r.llamada.contesto ? 'info' : 'aviso'}>{r.llamada.contesto ? 'Contestó' : 'No contestó'}</Insignia>}
        {r.demora > 0 && <Insignia tono="aviso">Se demora {r.demora} min</Insignia>}
      </div>
      {r.motivo && <p class="reserva__nota">Motivo: {r.motivo}</p>}
      {pendiente && (
        <div class="reserva__acciones">
          <Boton variante="primario" icono="check" desactivado={ocupado} alTocar={() => setAbierta('llego')}>
            Llegó
          </Boton>
          <Boton variante="tonal" desactivado={ocupado} alTocar={() => hacer(() => negocio.llamadaReserva(r.id, true), `Llamada a ${nombre}: contestó.`)}>
            Contestó
          </Boton>
          <Boton desactivado={ocupado} alTocar={() => hacer(() => negocio.llamadaReserva(r.id, false), `Llamada a ${nombre}: no contestó.`)}>
            No contestó
          </Boton>
          <Boton desactivado={ocupado} alTocar={() => setAbierta('demora')}>
            Se demora
          </Boton>
          <Boton variante="texto" desactivado={ocupado} alTocar={() => hacer(() => negocio.noLlegoReserva(r.id), `${nombre}: no llegó.`)}>
            No llegó
          </Boton>
          <Boton variante="texto" icono="cerrar" desactivado={ocupado} alTocar={() => setAbierta('cancelar')}>
            Cancelar
          </Boton>
        </div>
      )}
      {error && (
        <p class="reservas__error" role="alert">
          {error}
        </p>
      )}
      {abierta === 'demora' && (
        <Hoja titulo={`${nombre} se demora`} alCerrar={() => setAbierta(null)}>
          <div class="reservas__form">
            <p>¿Cuántos minutos avisó que se demora? La hora esperada y el tiempo de cancelación se corren.</p>
            <GrupoChips etiqueta="Minutos de demora">
              {[10, 15, 20, 30, 45, 60].map((min) => (
                <Chip
                  key={min}
                  seleccionado={false}
                  alCambiar={() => {
                    setAbierta(null);
                    hacer(() => negocio.demoraReserva(r.id, min), `${nombre} llega ${min} min tarde: espera hasta las ${masMinutos(r.hora, r.demora + min + r.tolerancia)}.`);
                  }}
                >
                  {min} min
                </Chip>
              ))}
            </GrupoChips>
          </div>
        </Hoja>
      )}
      {abierta === 'llego' && <HojaLlego reserva={r} alCerrar={() => setAbierta(null)} />}
      {abierta === 'cancelar' && <HojaCancelar reserva={r} alCerrar={() => setAbierta(null)} />}
    </article>
  );
}

/** Llegó: sentarla en una mesa libre (la de la reserva, si está libre) o solo marcar que llegó. */
function HojaLlego({ reserva: r, alCerrar }: { reserva: Reserva; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const { error, correr, ocupado } = useOperacion();
  const nombre = nombreDe(estado, r.cliente);
  const puedeSentar = negocio.puede('cuenta.sentar') && estado.caja !== null;
  const libres = Object.values(estado.mesas)
    .filter((m) => m.activa && !cuentaDeMesa(estado, m.id))
    .sort((a, b) => (a.id === r.mesaId ? -1 : b.id === r.mesaId ? 1 : 0) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));

  const llegar = (mesaId: string | null) =>
    void correr(async () => {
      await negocio.llegoReserva(r.id, { mesaId });
      const m = mesaId ? estado.mesas[mesaId] : null;
      avisar(m ? `${nombre} llegó y quedó en ${m.nombre}.` : `${nombre} llegó.`);
      alCerrar();
    });

  return (
    <Hoja titulo={`Llegó ${nombre}`} alCerrar={alCerrar}>
      <div class="reservas__form">
        {puedeSentar && libres.length > 0 ? (
          <>
            <p>¿En qué mesa la sientas? La mesa queda a nombre de {nombre}.</p>
            <ul class="mesas__rejilla" aria-label="Mesas libres">
              {libres.map((m) => (
                <li key={m.id}>
                  <button type="button" class="mesa mesa--libre" disabled={ocupado} onClick={() => llegar(m.id)}>
                    <span class="mesa__nombre">{m.nombre}</span>
                    <span class="mesa__estado">{m.id === r.mesaId ? 'Su mesa reservada' : m.zona}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{estado.caja === null ? 'No hay caja abierta: se marca que llegó, sin abrir mesa.' : 'No hay mesas libres: se marca que llegó.'}</p>
        )}
        <Boton desactivado={ocupado} alTocar={() => llegar(null)}>
          Solo marcar que llegó
        </Boton>
        {error && (
          <p class="reservas__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Hoja>
  );
}

function HojaCancelar({ reserva: r, alCerrar }: { reserva: Reserva; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const [motivo, setMotivo] = useState(situacionReserva(r, new Date()) === 'cancelable' ? 'No llegó a tiempo' : '');
  const { error, setError, correr, ocupado } = useOperacion();
  const nombre = nombreDe(estado, r.cliente);
  return (
    <Hoja
      titulo={`Cancelar reserva de ${nombre}`}
      alCerrar={alCerrar}
      pie={
        <div class="mesas__pie">
          {error && (
            <p class="reservas__error" role="alert">
              {error}
            </p>
          )}
          <Boton
            variante="peligro"
            ancho
            desactivado={ocupado}
            alTocar={() => {
              if (!motivo.trim()) return setError('Escribe el motivo.');
              void correr(() => negocio.cancelarReserva(r.id, motivo)).then((ok) => {
                if (ok) {
                  avisar(`Reserva de ${nombre} cancelada.`);
                  alCerrar();
                }
              });
            }}
          >
            Cancelar reserva
          </Boton>
        </div>
      }
    >
      <div class="reservas__form">
        <CampoTexto etiqueta="Motivo" valor={motivo} alCambiar={setMotivo} marcador="Llamó a cancelar, no llegó a tiempo…" />
      </div>
    </Hoja>
  );
}

// --- Nueva reserva -------------------------------------------------------------------

const TOLERANCIAS = [10, 15, 20, 30];

function NuevaReserva({ hoy, alCerrar }: { hoy: string; alCerrar: () => void }) {
  const { negocio, estado } = useNegocio();
  const { avisar } = useEstado();
  const [cliente, setCliente] = useState<RefCliente | null>(null);
  const [telefono, setTelefono] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const [hora, setHora] = useState('');
  const [personas, setPersonas] = useState('2');
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [tolerancia, setTolerancia] = useState('15');
  const [avisado, setAvisado] = useState(false);
  const [nota, setNota] = useState('');
  const { error, setError, correr, ocupado } = useOperacion();

  const horaLeida = (() => {
    try {
      return hora.trim() ? leerHora(hora) : null;
    } catch {
      return null;
    }
  })();
  const minutos = Number(tolerancia);
  const toleranciaValida = Number.isInteger(minutos) && minutos >= LIMITES.toleranciaMin && minutos <= LIMITES.toleranciaMax;
  const mesas = Object.values(estado.mesas)
    .filter((m) => m.activa)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  const telefonoCliente = cliente?.tipo === 'cliente' ? estado.clientes[cliente.clienteId]?.telefono : null;

  async function guardar() {
    let h: string;
    try {
      h = leerHora(hora);
    } catch (e) {
      setError(e instanceof RangeError ? e.message : 'Revisa la hora.');
      return;
    }
    const p = Number(personas);
    if (!cliente) return setError('¿A nombre de quién? Escribe el nombre o elige el cliente.');
    if (!Number.isInteger(p) || p < 1 || p > LIMITES.personas) return setError(`Personas: de 1 a ${LIMITES.personas}.`);
    if (!toleranciaValida) return setError(`Tiempo de espera: de ${LIMITES.toleranciaMin} a ${LIMITES.toleranciaMax} minutos.`);
    if (!avisado) return setError('Avísale al cliente el tiempo de espera y marca la casilla.');
    const ok = await correr(() =>
      negocio.crearReserva({ cliente, telefono: telefono || telefonoCliente || null, fecha, hora: h, personas: p, mesaId, tolerancia: minutos, avisado, nota }),
    );
    if (ok) {
      avisar(`Reserva guardada: ${nombreDe(estado, cliente)}, ${fecha === hoy ? 'hoy' : fechaLarga(fecha)} a las ${h}. ${recordatorio(h, minutos)}`);
      alCerrar();
    }
  }

  return (
    <Hoja
      titulo="Nueva reserva"
      alCerrar={alCerrar}
      pie={
        <div class="mesas__pie">
          {error && (
            <p class="reservas__error" role="alert">
              {error}
            </p>
          )}
          <Boton variante="primario" ancho icono="check" desactivado={ocupado} alTocar={() => void guardar()}>
            Guardar reserva
          </Boton>
        </div>
      }
    >
      <div class="reservas__form">
        <ElegirCliente valor={cliente} alCambiar={setCliente} />
        <CampoTexto
          etiqueta="Teléfono"
          tipo="tel"
          valor={telefono}
          alCambiar={setTelefono}
          marcador={telefonoCliente ?? 'Para llamar a confirmar'}
          ayuda={telefonoCliente ? 'Vacío: el del cliente.' : undefined}
        />
        <div class="reservas__fecha">
          <span>
            Fecha: <strong>{fecha === hoy ? 'hoy' : fechaLarga(fecha)}</strong>
          </span>
          <Boton variante="tonal" icono="calendario" alTocar={() => setEligiendoFecha(true)}>
            Cambiar fecha
          </Boton>
        </div>
        <div class="reservas__par">
          <CampoTexto etiqueta="Hora" valor={hora} alCambiar={setHora} marcador="20:00" ayuda={horaLeida ? `Las ${horaLeida}` : 'Ej.: 20:00 u 8 pm'} />
          <CampoNumero etiqueta="Personas" valor={personas} alCambiar={setPersonas} />
        </div>
        {mesas.length > 0 && (
          <fieldset class="vender__grupo">
            <legend>Mesa (opcional)</legend>
            <GrupoChips etiqueta="Mesa">
              <Chip seleccionado={mesaId === null} alCambiar={() => setMesaId(null)}>
                Sin mesa
              </Chip>
              {mesas.map((m) => (
                <Chip key={m.id} seleccionado={mesaId === m.id} alCambiar={(si) => setMesaId(si ? m.id : null)}>
                  {m.nombre}
                </Chip>
              ))}
            </GrupoChips>
          </fieldset>
        )}
        <fieldset class="vender__grupo">
          <legend>Tiempo de espera antes de cancelar</legend>
          <GrupoChips etiqueta="Minutos de espera">
            {TOLERANCIAS.map((t) => (
              <Chip key={t} seleccionado={tolerancia === String(t)} alCambiar={() => setTolerancia(String(t))}>
                {t} min
              </Chip>
            ))}
          </GrupoChips>
          <CampoNumero etiqueta="Minutos de espera" sufijo="min" valor={tolerancia} alCambiar={setTolerancia} />
        </fieldset>
        <CampoTexto etiqueta="Nota (opcional)" valor={nota} alCambiar={setNota} marcador="Cumpleaños, silla de bebé, terraza…" />
        <div class="reservas__recordatorio" role="note" aria-label="Aviso para el cliente">
          <p>
            <strong>Avísale al cliente ahora:</strong>{' '}
            {horaLeida && toleranciaValida
              ? recordatorio(horaLeida, minutos)
              : 'si no llega dentro del tiempo de espera después de la hora, la reserva se puede cancelar.'}
          </p>
          <Casilla etiqueta="Ya le avisé al cliente el tiempo de espera" marcada={avisado} alCambiar={setAvisado} />
        </div>
      </div>
      {eligiendoFecha && (
        <SelectorFecha
          hoy={hoy}
          alCerrar={() => setEligiendoFecha(false)}
          alElegir={(d) => {
            setFecha(d < hoy ? hoy : d);
            setEligiendoFecha(false);
          }}
        />
      )}
    </Hoja>
  );
}

// --- Clientes ----------------------------------------------------------------------------

const norma = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim();

function ListaClientes() {
  const { negocio, estado } = useNegocio();
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Cliente | 'nuevo' | null>(null);
  const q = norma(busqueda);
  const clientes = Object.values(estado.clientes)
    .filter((c) => !q || norma(`${c.nombre} ${c.telefono ?? ''} ${c.nota ?? ''}`).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const puede = negocio.puede('cliente.gestionar');
  return (
    <div class="reservas">
      <Buscador etiqueta="Buscar cliente" valor={busqueda} alCambiar={setBusqueda} marcador="Nombre, teléfono o nota" />
      {clientes.length === 0 ? (
        <EstadoVacio
          mensaje={Object.keys(estado.clientes).length === 0 ? 'Aún no hay clientes.' : 'Ningún cliente coincide.'}
          pista="Regístralos al hacer una reserva o con «Nuevo cliente»."
        />
      ) : (
        <ul class="elegir-cliente__lista clientes__lista" aria-label="Clientes">
          {clientes.map((c) => (
            <li key={c.id}>
              <button type="button" class="elegir-cliente__opcion" onClick={() => puede && setEditando(c)} disabled={!puede}>
                <strong>{c.nombre}</strong>
                {c.telefono && <span class="cifras">{c.telefono}</span>}
                {c.nota && <span>{c.nota}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="inv-espacio-flotante" aria-hidden="true" />
      {puede && <BotonFlotante etiqueta="Nuevo cliente" extendido alTocar={() => setEditando('nuevo')} />}
      {editando && <HojaCliente cliente={editando === 'nuevo' ? null : editando} alCerrar={() => setEditando(null)} />}
    </div>
  );
}

function HojaCliente({ cliente, alCerrar }: { cliente: Cliente | null; alCerrar: () => void }) {
  const { negocio } = useNegocio();
  const { avisar } = useEstado();
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [nota, setNota] = useState(cliente?.nota ?? '');
  const { error, setError, correr, ocupado } = useOperacion();
  async function guardar() {
    if (!nombre.trim()) return setError('Escribe el nombre.');
    const datos = { nombre, telefono, nota };
    const ok = await correr(() => (cliente ? negocio.editarCliente(cliente.id, datos) : negocio.crearCliente(datos)));
    if (ok) {
      avisar(cliente ? 'Cliente actualizado.' : `«${nombre.trim()}» registrado.`);
      alCerrar();
    }
  }
  return (
    <Hoja
      titulo={cliente ? `Editar ${cliente.nombre}` : 'Nuevo cliente'}
      alCerrar={alCerrar}
      pie={
        <div class="mesas__pie">
          {error && (
            <p class="reservas__error" role="alert">
              {error}
            </p>
          )}
          <Boton variante="primario" ancho icono="check" desactivado={ocupado} alTocar={() => void guardar()}>
            Guardar
          </Boton>
        </div>
      }
    >
      <div class="reservas__form">
        <CampoTexto etiqueta="Nombre" valor={nombre} alCambiar={setNombre} />
        <CampoTexto etiqueta="Teléfono" tipo="tel" valor={telefono} alCambiar={setTelefono} marcador="Opcional" />
        <CampoTexto etiqueta="Nota" valor={nota} alCambiar={setNota} marcador="Opcional: preferencias, alergias…" />
      </div>
    </Hoja>
  );
}
