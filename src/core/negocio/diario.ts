/**
 * Diario del negocio: lista de eventos que sólo crece, encadenada con hashes.
 *
 * Archivos (dentro del `Almacen`, que ya los cifra y los escribe de forma atómica):
 * - `negocio/diario/AAAA-MM-DD.json`: arreglo JSON con los registros de ese día local.
 * - `negocio/instantanea.json`: `{ version, archivo, hastaId, hash, estado }`, un atajo
 *   para no repetir toda la historia al abrir. Se escribe al cerrar caja. Si falta o está
 *   dañada, se repite todo: es sólo un atajo, la verdad es el diario.
 *
 * Cadena: hash = SHA-256(hashAnterior + JSON canónico del evento sin `hash`), en
 * hexadecimal; el primer «anterior» son 64 ceros. Cambiar, quitar o reordenar un evento
 * rompe la cadena desde ese punto, y `verificar()` dice dónde.
 *
 * Reglas de seguridad de la contabilidad:
 * - Si un archivo no se puede leer, no es JSON, trae un evento mal formado o la cadena no
 *   cuadra, `cargar()` lanza `DiarioDanado` y el diario queda BLOQUEADO para escribir:
 *   no se escribe encima de una historia que no se entiende.
 * - Si una escritura falla, también se bloquea (no se sabe qué quedó en disco) hasta
 *   `cargar()` otra vez.
 * - Las escrituras van en fila (una cola interna): validar → encadenar → escribir →
 *   aplicar ocurre de a un evento, contra el estado más reciente.
 * - Un evento nunca se escribe en un archivo de un día ANTERIOR al último usado (si el
 *   reloj del teléfono retrocede, va al último día): el orden de la cadena es el orden de
 *   los archivos.
 */
import type { Almacen } from '../almacen/almacen';
import { diaDe, leerEvento, leerRegistro, type Evento, type Registro } from './eventos';
import { aplicar, estadoVacio, HASH_INICIAL, validar, VERSION_ESTADO, type EstadoNegocio } from './estado';

export const CARPETA_DIARIO = 'negocio/diario';
export const RUTA_INSTANTANEA = 'negocio/instantanea.json';
const ARCHIVO_DIA = /^(\d{4}-\d{2}-\d{2})\.json$/;
const VERSION_INSTANTANEA = 1;

/** El diario no se puede leer o su cadena no cuadra. `indice` -1 = el archivo entero. */
export class DiarioDanado extends Error {
  constructor(
    readonly archivo: string,
    readonly indice: number,
    readonly motivo: string,
  ) {
    super(
      `El diario del negocio está dañado en ${archivo}${indice >= 0 ? ` (registro ${indice + 1})` : ''}: ${motivo}. ` +
        'No se escribirá nada nuevo hasta revisarlo (restaura un respaldo).',
    );
    this.name = 'DiarioDanado';
  }
}

/** JSON con las claves ordenadas en todos los niveles: el mismo objeto da el mismo texto. */
export function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') {
    const t = JSON.stringify(valor);
    if (t === undefined) throw new TypeError('Valor no serializable');
    return t;
  }
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`;
  const claves = Object.keys(valor)
    .filter((k) => (valor as Record<string, unknown>)[k] !== undefined)
    .sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(',')}}`;
}

/** SHA-256 en hexadecimal. */
export async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash de un evento encadenado al anterior. Ignora un `hash` que traiga el objeto. */
export async function hashEvento(anterior: string, evento: Evento | Registro): Promise<string> {
  const { id, tipo, en, por, datos } = evento;
  return sha256(anterior + canonico({ id, tipo, en, por, datos }));
}

export type Verificacion =
  | { readonly ok: true; readonly eventos: number; readonly ultimoHash: string }
  | {
      readonly ok: false;
      readonly eventos: number;
      readonly archivo: string;
      readonly indice: number;
      readonly eventoId: string | null;
      readonly motivo: string;
    };

interface Instantanea {
  readonly version: number;
  readonly archivo: string;
  readonly hastaId: string;
  readonly hash: string;
  readonly estado: EstadoNegocio;
}

/** Lo que se pasa a `agregar`: el evento, o una función que lo arma con el estado vigente. */
export type EntradaDiario = Evento | ((estado: EstadoNegocio) => Evento);

export class Diario {
  private estadoActual: EstadoNegocio = estadoVacio();
  private ultimoDia: string | null = null;
  private registrosDia: readonly Registro[] = [];
  private cargado = false;
  private bloqueo: Error | null = null;
  private cola: Promise<unknown> = Promise.resolve();

  constructor(private readonly almacen: Almacen) {}

  /** Estado proyectado tras el último evento escrito. */
  get estado(): EstadoNegocio {
    return this.estadoActual;
  }

  /** Error que impide escribir (diario dañado o escritura fallida), o `null`. */
  get error(): Error | null {
    return this.bloqueo;
  }

  private enFila<T>(tarea: () => Promise<T>): Promise<T> {
    const actual = this.cola.catch(() => undefined).then(tarea);
    this.cola = actual;
    return actual;
  }

  private ruta(dia: string): string {
    return `${CARPETA_DIARIO}/${dia}.json`;
  }

  private async archivosDia(): Promise<string[]> {
    const nombres = await this.almacen.listar(CARPETA_DIARIO);
    return nombres.filter((n) => ARCHIVO_DIA.test(n)).sort();
  }

  private async leerArchivo(nombre: string): Promise<Registro[]> {
    let texto: string | null;
    try {
      texto = await this.almacen.leer(`${CARPETA_DIARIO}/${nombre}`);
    } catch (e) {
      throw new DiarioDanado(nombre, -1, `no se pudo leer (${e instanceof Error ? e.message : String(e)})`);
    }
    if (texto === null) throw new DiarioDanado(nombre, -1, 'el archivo desapareció');
    let datos: unknown;
    try {
      datos = JSON.parse(texto);
    } catch {
      throw new DiarioDanado(nombre, -1, 'no es JSON válido');
    }
    if (!Array.isArray(datos)) throw new DiarioDanado(nombre, -1, 'no es una lista de eventos');
    return datos.map((x, i) => {
      try {
        return leerRegistro(x);
      } catch (e) {
        throw new DiarioDanado(nombre, i, e instanceof Error ? e.message : 'evento mal formado');
      }
    });
  }

  private async leerInstantanea(): Promise<Instantanea | null> {
    try {
      const texto = await this.almacen.leer(RUTA_INSTANTANEA);
      if (texto === null) return null;
      const x = JSON.parse(texto) as Partial<Instantanea> | null;
      const valida =
        x !== null &&
        typeof x === 'object' &&
        x.version === VERSION_INSTANTANEA &&
        typeof x.archivo === 'string' &&
        ARCHIVO_DIA.test(x.archivo) &&
        typeof x.hastaId === 'string' &&
        typeof x.hash === 'string' &&
        typeof x.estado === 'object' &&
        x.estado !== null &&
        x.estado.version === VERSION_ESTADO &&
        x.estado.ultimoHash === x.hash &&
        x.estado.ultimoId === x.hastaId;
      return valida ? (x as Instantanea) : null;
    } catch {
      return null; // Es un atajo: si no sirve, se repite el diario completo.
    }
  }

  /**
   * Lee el diario y reconstruye el estado (desde la instantánea si sirve). Comprueba la
   * cadena de todo lo que repite. Lanza `DiarioDanado` y deja el diario bloqueado si algo
   * no cuadra. Se puede volver a llamar (por ejemplo, tras restaurar un respaldo).
   */
  cargar(): Promise<EstadoNegocio> {
    return this.enFila(async () => {
      this.cargado = false;
      this.bloqueo = null;
      try {
        await this.cargarAhora();
        this.cargado = true;
        return this.estadoActual;
      } catch (e) {
        this.bloqueo = e instanceof Error ? e : new Error(String(e));
        throw this.bloqueo;
      }
    });
  }

  private async cargarAhora(): Promise<void> {
    const archivos = await this.archivosDia();
    let estado = estadoVacio();
    let desdeArchivo = 0;
    let desdeIndice = 0;
    let cache: { nombre: string; registros: Registro[] } | null = null;

    const inst = await this.leerInstantanea();
    // La instantánea se escribe DESPUÉS de su evento: si existe, ese evento tiene que estar.
    let instEncontrada = inst === null;
    if (inst) {
      const i = archivos.indexOf(inst.archivo);
      if (i >= 0) {
        const registros = await this.leerArchivo(inst.archivo);
        const pos = registros.findIndex((r) => r.id === inst.hastaId);
        if (pos >= 0 && registros[pos]?.hash === inst.hash) {
          estado = inst.estado;
          desdeArchivo = i;
          desdeIndice = pos + 1;
          cache = { nombre: inst.archivo, registros };
          instEncontrada = true;
        }
      }
    }

    let registrosUltimo: Registro[] = [];
    for (let a = desdeArchivo; a < archivos.length; a++) {
      const nombre = archivos[a] as string;
      const registros = cache?.nombre === nombre ? cache.registros : await this.leerArchivo(nombre);
      for (let i = a === desdeArchivo ? desdeIndice : 0; i < registros.length; i++) {
        const r = registros[i] as Registro;
        const hash = await hashEvento(estado.ultimoHash, r);
        if (hash !== r.hash) throw new DiarioDanado(nombre, i, 'la cadena de hashes no cuadra (un evento cambió o falta)');
        if (inst && r.id === inst.hastaId && hash === inst.hash) instEncontrada = true;
        const { hash: _h, ...evento } = r;
        void _h;
        estado = aplicar(estado, evento as Evento, hash);
      }
      registrosUltimo = registros;
    }
    if (!instEncontrada) {
      throw new DiarioDanado('instantanea.json', -1, 'apunta a un evento que ya no está en el diario (faltan eventos)');
    }

    this.estadoActual = estado;
    const ultimo = archivos[archivos.length - 1];
    this.ultimoDia = ultimo ? ultimo.slice(0, 10) : null;
    this.registrosDia = registrosUltimo;
  }

  /**
   * Valida y añade un evento. Devuelve el evento escrito (copia limpia) y el estado nuevo.
   * Lanza `ReglaRota` si una regla lo impide (y no escribe nada), o el error del diario.
   */
  async agregar(entrada: EntradaDiario): Promise<{ evento: Evento; estado: EstadoNegocio }> {
    const r = await this.agregarVarios((estado) => [typeof entrada === 'function' ? entrada(estado) : entrada]);
    return { evento: r.eventos[0] as Evento, estado: r.estado };
  }

  /**
   * Añade varios eventos como UNA operación atómica: se validan uno tras otro (cada uno
   * contra el estado que dejó el anterior) y se escriben en una sola escritura. Si uno
   * rompe una regla, no se escribe ninguno. Una lista vacía no escribe nada.
   */
  agregarVarios(armar: (estado: EstadoNegocio) => readonly Evento[]): Promise<{ eventos: Evento[]; estado: EstadoNegocio }> {
    return this.enFila(async () => {
      if (this.bloqueo) throw this.bloqueo;
      if (!this.cargado) throw new Error('El diario no está cargado.');
      const crudos = armar(this.estadoActual);
      if (crudos.length === 0) return { eventos: [], estado: this.estadoActual }; // nada que escribir
      let estado = this.estadoActual;
      const eventos: Evento[] = [];
      const nuevos: Registro[] = [];
      for (const crudo of crudos) {
        const evento = leerEvento(crudo);
        validar(estado, evento);
        const hash = await hashEvento(estado.ultimoHash, evento);
        estado = aplicar(estado, evento, hash);
        eventos.push(evento);
        nuevos.push({ ...evento, hash } as Registro);
      }

      const diaEvento = diaDe(eventos[eventos.length - 1] as Evento);
      const dia = this.ultimoDia !== null && this.ultimoDia > diaEvento ? this.ultimoDia : diaEvento;
      const registros = [...(dia === this.ultimoDia ? this.registrosDia : []), ...nuevos];
      try {
        await this.almacen.escribir(this.ruta(dia), JSON.stringify(registros));
      } catch (e) {
        this.bloqueo = new DiarioDanado(
          `${dia}.json`,
          registros.length - 1,
          `no se pudo escribir (${e instanceof Error ? e.message : String(e)})`,
        );
        throw this.bloqueo;
      }
      this.ultimoDia = dia;
      this.registrosDia = registros;
      this.estadoActual = estado;

      if (eventos.some((e) => e.tipo === 'caja.cerrada')) {
        try {
          await this.escribirInstantanea();
        } catch {
          // La instantánea es un atajo: si falla, la próxima carga repite el diario.
        }
      }
      return { eventos, estado };
    });
  }

  private async escribirInstantanea(): Promise<void> {
    if (this.ultimoDia === null || this.estadoActual.ultimoId === null) return;
    const inst: Instantanea = {
      version: VERSION_INSTANTANEA,
      archivo: `${this.ultimoDia}.json`,
      hastaId: this.estadoActual.ultimoId,
      hash: this.estadoActual.ultimoHash,
      estado: this.estadoActual,
    };
    await this.almacen.escribir(RUTA_INSTANTANEA, JSON.stringify(inst));
  }

  /** Guarda la instantánea ahora (además de al cerrar caja). */
  guardarInstantanea(): Promise<void> {
    return this.enFila(() => this.escribirInstantanea());
  }

  /**
   * Recorre TODO el diario y comprueba la cadena. Devuelve la primera ruptura (no lanza).
   * También detecta eventos quitados al final: si la instantánea o el estado en memoria
   * apuntan a un evento que ya no está.
   */
  verificar(): Promise<Verificacion> {
    return this.enFila(async () => {
      let n = 0;
      let anterior = HASH_INICIAL;
      const vistos = new Map<string, string>();
      let archivos: string[];
      try {
        archivos = await this.archivosDia();
      } catch (e) {
        return { ok: false, eventos: 0, archivo: CARPETA_DIARIO, indice: -1, eventoId: null, motivo: String(e) };
      }
      for (const nombre of archivos) {
        let registros: Registro[];
        try {
          registros = await this.leerArchivo(nombre);
        } catch (e) {
          const d = e instanceof DiarioDanado ? e : null;
          return { ok: false, eventos: n, archivo: nombre, indice: d?.indice ?? -1, eventoId: null, motivo: d?.motivo ?? String(e) };
        }
        for (let i = 0; i < registros.length; i++) {
          const r = registros[i] as Registro;
          const hash = await hashEvento(anterior, r);
          if (hash !== r.hash) {
            return {
              ok: false,
              eventos: n,
              archivo: nombre,
              indice: i,
              eventoId: r.id,
              motivo: 'la cadena de hashes no cuadra: este evento o uno anterior cambió, se quitó o se reordenó',
            };
          }
          vistos.set(r.id, hash);
          anterior = hash;
          n++;
        }
      }
      const inst = await this.leerInstantanea();
      if (inst && vistos.get(inst.hastaId) !== inst.hash) {
        return {
          ok: false,
          eventos: n,
          archivo: RUTA_INSTANTANEA,
          indice: -1,
          eventoId: inst.hastaId,
          motivo: 'la instantánea apunta a un evento que ya no está en el diario (se quitaron eventos)',
        };
      }
      if (this.cargado && this.estadoActual.ultimoId !== null && vistos.get(this.estadoActual.ultimoId) !== this.estadoActual.ultimoHash) {
        return {
          ok: false,
          eventos: n,
          archivo: CARPETA_DIARIO,
          indice: -1,
          eventoId: this.estadoActual.ultimoId,
          motivo: 'faltan eventos que esta sesión escribió',
        };
      }
      return { ok: true, eventos: n, ultimoHash: anterior };
    });
  }

  /**
   * Eventos guardados en los archivos de los días `desde`..`hasta` (inclusive, 'AAAA-MM-DD';
   * sin límites = todos), en orden. No comprueba la cadena (para eso, `verificar`).
   */
  eventos(rango: { readonly desde?: string; readonly hasta?: string } = {}): Promise<Evento[]> {
    return this.enFila(async () => {
      const r: Evento[] = [];
      for (const nombre of await this.archivosDia()) {
        const dia = nombre.slice(0, 10);
        if ((rango.desde !== undefined && dia < rango.desde) || (rango.hasta !== undefined && dia > rango.hasta)) continue;
        for (const reg of await this.leerArchivo(nombre)) {
          const { hash: _h, ...evento } = reg;
          void _h;
          r.push(evento as Evento);
        }
      }
      return r;
    });
  }
}
