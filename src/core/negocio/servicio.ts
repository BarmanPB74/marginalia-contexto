/**
 * `Negocio`: lo que usan las pantallas. Junta diario + estado + permisos + sesión.
 *
 * Flujo de cada operación (`ejecutar`), dentro de la fila del diario:
 *   1. arma el comando con el estado MÁS RECIENTE (dos toques rápidos no se pisan);
 *   2. comprueba que haya sesión y que el cargo pueda hacerlo (`permisos.ts`);
 *   3. el diario valida las reglas (`estado.validar`), encadena y escribe UNA vez;
 *   4. avisa a los suscriptores con el estado nuevo.
 *
 * La pantalla nunca manda totales: `vender`, `registrarCompra`, `cerrarCaja`… los calculan
 * aquí con los precios y el estado vigentes. Si la pantalla mostraba otra cosa (el precio
 * cambió, la caja se movió), la regla lo detecta y lo dice.
 *
 * Primer uso: si no hay usuarios, `crearUsuario` no pide sesión y el primero es dueño.
 */
import type { Almacen } from '../almacen/almacen';
import { ulid } from '../notas/ulid';
import {
  aplicarDescuento,
  centavos,
  importe,
  milesimas,
  pesos,
  type Centavos,
  type Descuento,
  type Milesimas,
} from './numeros';
import { LIMITES, NOMBRE_ROL, type FormaEgreso, type FormaPago, type MotivoAjuste, type Rol, type Unidad, type Usuario } from './modelo';
import {
  crearEvento,
  diaDe,
  ReglaRota,
  sinIndefinidos,
  type Comando,
  type DatosProducto,
  type Evento,
  type LineaCompra,
  type LineaVenta,
  type PagoVenta,
} from './eventos';
import { esperadoCaja, hayUsuarios, stockDe, vendidoCaja, type EstadoNegocio, type PorForma } from './estado';
import { accionDe, NOMBRE_ACCION, puede, type Accion } from './permisos';
import { hashPin, ITERACIONES_PIN, Limitador, validarFormatoPin, verificarPin } from './pin';
import { Diario, type Verificacion } from './diario';
import type { AccionImportacion } from './importar';
import { movimientosStock, resumen, type MovimientoStock, type Periodo, type Resumen } from './contabilidad';

/** El cargo de la sesión no permite la operación. */
export class SinPermiso extends ReglaRota {
  constructor(readonly accion: Accion, rol: Rol | null) {
    super(
      rol === null
        ? 'Inicia sesión para continuar.'
        : `Tu cargo (${NOMBRE_ROL[rol]}) no permite ${NOMBRE_ACCION[accion]}. Pídeselo al dueño.`,
    );
    this.name = 'SinPermiso';
  }
}

/** Usuario sin su PIN guardado: lo que se puede mostrar. */
export type UsuarioPublico = Omit<Usuario, 'pin'>;

export type ResultadoSesion =
  | { readonly ok: true; readonly usuario: UsuarioPublico }
  | {
      readonly ok: false;
      readonly motivo: 'desconocido' | 'inactivo' | 'pin' | 'bloqueado';
      readonly mensaje: string;
      /** Si está bloqueado: cuánto falta para volver a intentar. */
      readonly esperaMs?: number;
    };

/** Recibe el estado nuevo y el evento que lo produjo (`null` si sólo cambió la sesión). */
/** Un movimiento de plata de la caja abierta (ver `movimientosCaja`). */
export interface MovimientoCaja {
  readonly id: string;
  readonly en: string;
  /** Nombre de quien lo hizo */
  readonly por: string;
  readonly tipo: 'ingreso' | 'retiro' | 'gasto' | 'pago';
  readonly monto: Centavos;
  readonly detalle: string;
}

export type Oyente = (estado: EstadoNegocio, evento: Evento | null) => void;

export interface OpcionesNegocio {
  /** Hora actual (inyectable para pruebas). */
  readonly reloj?: () => Date;
  /** Iteraciones PBKDF2 de los PIN nuevos (bajar SOLO en pruebas). */
  readonly iteracionesPin?: number;
  readonly limitador?: Limitador;
}

export interface ResumenCierre {
  readonly cajaId: string;
  readonly abiertaEn: string;
  readonly abiertaPor: string;
  readonly base: Centavos;
  readonly ventasPorForma: PorForma;
  readonly vendido: Centavos;
  readonly ventas: number;
  readonly anuladas: number;
  readonly ingresos: Centavos;
  readonly retiros: Centavos;
  readonly gastos: Centavos;
  readonly pagos: Centavos;
  /** base + efectivo + ingresos − retiros − gastos − pagos de caja. */
  readonly esperado: Centavos;
  readonly contado: Centavos | null;
  /** contado − esperado (negativo = falta plata). */
  readonly diferencia: Centavos | null;
  /** Sin ventas ni movimientos: para cerrar hay que escribir el motivo. */
  readonly sinMovimientos: boolean;
}

export interface ErrorImportacionFila {
  /** Fila del archivo original (desde 1, como en Excel). */
  readonly fila: number;
  readonly nombre: string;
  readonly motivo: string;
}

export interface ResultadoImportacion {
  readonly creados: number;
  readonly ajustados: number;
  /** Productos cuya existencia ya era la importada. */
  readonly sinCambio: number;
  readonly errores: readonly ErrorImportacionFila[];
}

export interface LineaPedida {
  readonly productoId: string;
  readonly cantidad: Milesimas;
}

export interface PagoPedido {
  readonly forma: FormaPago;
  /** Sin monto = «el resto» (sólo uno puede ir sin monto). */
  readonly monto?: Centavos;
}

export interface NuevoProducto {
  readonly nombre: string;
  readonly categoria: string;
  readonly unidad: Unidad;
  readonly precio: Centavos;
  readonly costo?: Centavos | null;
  readonly stockMinimo?: Milesimas | null;
  readonly codigo?: string | null;
}

export interface NuevaCompra {
  readonly proveedor: string;
  readonly numero: string;
  readonly fecha: string;
  readonly vence?: string | null;
  readonly lineas: readonly LineaCompra[];
  readonly adjuntos?: readonly string[];
  readonly nota?: string | null;
}

export interface NuevoGasto {
  readonly categoria: string;
  readonly descripcion: string;
  readonly monto: Centavos;
  readonly forma: FormaEgreso;
  readonly deCaja: boolean;
  readonly adjunto?: string | null;
}

/** Texto recortado; vacío → undefined (para campos opcionales). */
function opcional(t: string | null | undefined): string | undefined {
  const r = (t ?? '').trim();
  return r ? r : undefined;
}

function publico(u: Usuario): UsuarioPublico {
  return { id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo };
}

export class Negocio {
  private sesionId: string | null = null;
  private readonly oyentes = new Set<Oyente>();
  private readonly reloj: () => Date;
  private readonly iteracionesPin: number;
  private readonly limitador: Limitador;

  private constructor(
    private readonly diario: Diario,
    opciones: OpcionesNegocio,
  ) {
    this.reloj = opciones.reloj ?? (() => new Date());
    this.iteracionesPin = opciones.iteracionesPin ?? ITERACIONES_PIN;
    this.limitador = opciones.limitador ?? new Limitador();
  }

  /** Abre el negocio sobre un almacén: carga el diario. Lanza `DiarioDanado` si no cuadra. */
  static async crear(almacen: Almacen, opciones: OpcionesNegocio = {}): Promise<Negocio> {
    const diario = new Diario(almacen);
    await diario.cargar();
    return new Negocio(diario, opciones);
  }

  get estado(): EstadoNegocio {
    return this.diario.estado;
  }

  /** No hay usuarios todavía: la pantalla debe pedir crear al dueño. */
  get primerUso(): boolean {
    return !hayUsuarios(this.estado);
  }

  /** Usuario con sesión abierta (se relee del estado: si lo desactivan, queda fuera). */
  get sesion(): UsuarioPublico | null {
    const u = this.sesionId ? this.estado.usuarios[this.sesionId] : undefined;
    return u?.activo ? publico(u) : null;
  }

  /** Usuarios activos, para el selector de «¿quién eres?». */
  usuarios(): UsuarioPublico[] {
    return Object.values(this.estado.usuarios)
      .filter((u) => u.activo)
      .map(publico)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** ¿La sesión puede hacer esto? Para mostrar u ocultar botones. */
  puede(accion: Accion): boolean {
    const u = this.sesion;
    return u !== null && puede(u.rol, accion);
  }

  suscribir(fn: Oyente): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  private avisar(evento: Evento | null): void {
    for (const fn of this.oyentes) {
      try {
        fn(this.estado, evento);
      } catch {
        // Un error de una pantalla no puede tumbar la contabilidad.
      }
    }
  }

  private exigir(accion: Accion): UsuarioPublico {
    const u = this.sesion;
    if (!u || !puede(u.rol, accion)) throw new SinPermiso(accion, u?.rol ?? null);
    return u;
  }

  // --- Sesión ---------------------------------------------------------------------

  async iniciarSesion(usuarioId: string, pin: string): Promise<ResultadoSesion> {
    const u = this.estado.usuarios[usuarioId];
    if (!u) return { ok: false, motivo: 'desconocido', mensaje: 'Ese usuario no existe.' };
    if (!u.activo) return { ok: false, motivo: 'inactivo', mensaje: `«${u.nombre}» está desactivado.` };
    const ahora = this.reloj().getTime();
    const antes = this.limitador.puedeIntentar(usuarioId, ahora);
    if (!antes.permitido) {
      return { ok: false, motivo: 'bloqueado', esperaMs: antes.esperaMs, mensaje: mensajeEspera(antes.esperaMs) };
    }
    if (await verificarPin(pin, u.pin)) {
      this.limitador.registrarExito(usuarioId);
      this.sesionId = usuarioId;
      this.avisar(null);
      return { ok: true, usuario: publico(u) };
    }
    const despues = this.limitador.registrarFallo(usuarioId, ahora);
    if (!despues.permitido) {
      return { ok: false, motivo: 'bloqueado', esperaMs: despues.esperaMs, mensaje: `PIN incorrecto. ${mensajeEspera(despues.esperaMs)}` };
    }
    return { ok: false, motivo: 'pin', mensaje: 'PIN incorrecto.' };
  }

  cerrarSesion(): void {
    this.sesionId = null;
    this.avisar(null);
  }

  // --- Núcleo -----------------------------------------------------------------------

  /**
   * Ejecuta un comando: permiso → reglas → UNA escritura → aviso. `comando` puede ser una
   * función que lo arma con el estado vigente (dentro de la fila del diario).
   * Lanza `SinPermiso` / `ReglaRota` (mensajes para la persona) o `DiarioDanado`.
   */
  async ejecutar(comando: Comando | ((estado: EstadoNegocio) => Comando)): Promise<Evento> {
    const [evento] = await this.ejecutarVarios((estado) => [typeof comando === 'function' ? comando(estado) : comando]);
    if (!evento) throw new Error('No se escribió el evento.');
    return evento;
  }

  /**
   * Varios comandos como UNA operación atómica (una escritura; si uno falla, ninguno se
   * guarda). `armar` recibe el estado vigente y `nuevoId()` para enlazar comandos (por
   * ejemplo, crear un producto y ajustar su stock): el comando i-ésimo usa el id i-ésimo.
   */
  async ejecutarVarios(armar: (estado: EstadoNegocio, nuevoId: (indice: number) => string) => readonly Comando[]): Promise<Evento[]> {
    const ahora = this.reloj();
    const ids: string[] = [];
    const nuevoId = (i: number): string => {
      while (ids.length <= i) ids.push(ulid(ahora.getTime()));
      return ids[i] as string;
    };
    const { eventos } = await this.diario.agregarVarios((estado) =>
      armar(estado, nuevoId).map((cmd, i) => {
        const id = nuevoId(i);
        if (!hayUsuarios(estado)) {
          if (cmd.tipo !== 'usuario.creado' || i > 0) throw new ReglaRota('Primero crea el usuario del dueño.');
          return crearEvento(cmd, id, ahora, id);
        }
        const u = this.sesionId ? estado.usuarios[this.sesionId] : undefined;
        const evento = crearEvento(cmd, u?.id ?? '', ahora, id);
        const accion = accionDe(evento);
        if (!u || !u.activo) throw new SinPermiso(accion, null);
        if (!puede(u.rol, accion)) throw new SinPermiso(accion, u.rol);
        return evento;
      }),
    );
    for (const e of eventos) this.avisar(e);
    return eventos;
  }

  // --- Importación ------------------------------------------------------------------

  /**
   * Aplica un plan de importación (`importar/planImportacion`) ya confirmado por la persona.
   * Cada producto es UNA operación atómica (crear + stock inicial, o el ajuste); si uno no
   * se puede, se anota el error y se sigue con los demás. Las cantidades pueden ser
   * negativas (inventarios reales). Los ajustes quedan con motivo «importacion».
   * Crear productos fija su precio: exige el permiso de crear productos (dueño); con
   * `actualizarPrecios` también se copian precio y costo de la fila (permiso de precios).
   */
  async importarInventario(
    acciones: readonly AccionImportacion[],
    opciones: { actualizarPrecios?: boolean } = {},
  ): Promise<ResultadoImportacion> {
    this.exigir('inventario.importar');
    const r = { creados: 0, ajustados: 0, sinCambio: 0, errores: [] as ErrorImportacionFila[] };
    for (const a of acciones) {
      try {
        let ajusto = false;
        await this.ejecutarVarios((estado, nuevoId) => {
          ajusto = false;
          if (a.tipo === 'crear') {
            const f = a.fila;
            const productoId = nuevoId(0);
            const cmds: Comando[] = [
              {
                tipo: 'producto.creado',
                datos: {
                  nombre: recortar(f.nombre, LIMITES.nombre),
                  categoria: recortar(f.categoria ?? '', LIMITES.categoria) || 'Sin categoría',
                  unidad: unidadDe(f.unidad),
                  precio: f.precio ?? centavos(0),
                  costo: f.costo ?? null,
                  stockMinimo: null,
                  codigo: recortar(f.codigo ?? '', LIMITES.codigo) || null,
                },
              },
            ];
            if (f.cantidad !== 0) {
              cmds.push({
                tipo: 'inventario.ajuste',
                datos: { productoId, delta: f.cantidad, motivo: 'importacion', antes: milesimas(0), despues: f.cantidad },
              });
            }
            return cmds;
          }
          const antes = stockDe(estado, a.productoId);
          const delta = milesimas(a.modo === 'fijar' ? a.objetivo - antes : a.delta);
          const cmds: Comando[] = [];
          if (delta !== 0) {
            cmds.push({
              tipo: 'inventario.ajuste',
              datos: { productoId: a.productoId, delta, motivo: 'importacion', antes, despues: milesimas(antes + delta) },
            });
          }
          if (opciones.actualizarPrecios) {
            const cambios: Partial<DatosProducto> = sinIndefinidos({ precio: a.fila.precio, costo: a.fila.costo });
            if (Object.keys(cambios).length > 0) cmds.push({ tipo: 'producto.editado', datos: { productoId: a.productoId, cambios } });
          }
          ajusto = cmds.length > 0;
          return cmds;
        });
        if (a.tipo === 'crear') r.creados++;
        else if (ajusto) r.ajustados++;
        else r.sinCambio++;
      } catch (e) {
        r.errores.push({
          fila: a.fila.filaOriginal,
          nombre: a.tipo === 'crear' ? a.fila.nombre : a.nombre,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return r;
  }

  // --- Caja -------------------------------------------------------------------------

  abrirCaja(base: Centavos): Promise<Evento> {
    return this.ejecutar({ tipo: 'caja.abierta', datos: { base } });
  }

  movimientoCaja(m: { tipo: 'ingreso' | 'retiro'; monto: Centavos; motivo: string }): Promise<Evento> {
    return this.ejecutar({ tipo: 'caja.movimiento', datos: { tipo: m.tipo, monto: m.monto, motivo: m.motivo.trim() } });
  }

  /** Cifras para la pantalla de cierre (y la caja en vivo). `null` si no hay caja abierta. */
  resumenCierre(contado?: Centavos): ResumenCierre | null {
    const c = this.estado.caja;
    if (!c) return null;
    const esperado = esperadoCaja(c);
    return {
      cajaId: c.id,
      abiertaEn: c.abiertaEn,
      abiertaPor: this.estado.usuarios[c.abiertaPor]?.nombre ?? '—',
      base: c.base,
      ventasPorForma: c.ventasPorForma,
      vendido: vendidoCaja(c),
      ventas: c.ventas,
      anuladas: c.anuladas,
      ingresos: c.ingresos,
      retiros: c.retiros,
      gastos: c.gastos,
      pagos: c.pagos,
      esperado,
      contado: contado ?? null,
      diferencia: contado === undefined ? null : centavos(contado - esperado),
      sinMovimientos: c.actividad === 0,
    };
  }

  /**
   * Cierra la caja. Sin `confirmar: true` no cierra (la regla lo exige): muestra antes
   * `resumenCierre(contado)`. `esperadoVisto` es el esperado que vio la persona: si la caja
   * se movió desde entonces, el cierre se rechaza y hay que volver a contar.
   */
  cerrarCaja(c: { contado: Centavos; nota?: string | null; confirmar: boolean; esperadoVisto?: Centavos }): Promise<Evento> {
    return this.ejecutar((estado) => {
      const caja = estado.caja;
      if (!caja) throw new ReglaRota('No hay caja abierta.');
      const esperado = c.esperadoVisto ?? esperadoCaja(caja);
      return {
        tipo: 'caja.cerrada',
        datos: sinIndefinidos({
          cajaId: caja.id,
          contado: c.contado,
          esperado,
          diferencia: centavos(c.contado - esperado),
          confirmado: c.confirmar === true,
          nota: opcional(c.nota),
        }),
      };
    });
  }

  // --- Ventas -----------------------------------------------------------------------

  /**
   * Registra una venta. El núcleo pone precios, subtotales, descuento y total; la pantalla
   * sólo dice qué, cuánto y cómo pagan. Líneas repetidas se suman. Descuenta el stock de
   * todos los productos en una sola escritura.
   */
  async vender(v: {
    lineas: readonly LineaPedida[];
    descuento?: Descuento | null;
    pagos: readonly PagoPedido[];
    recibido?: Centavos | null;
  }): Promise<Evento> {
    if (v.descuento && v.descuento.valor > 0) this.exigir('venta.descuento');
    return this.ejecutar((estado) => armarVenta(estado, v));
  }

  /**
   * Cobra la cuenta de una mesa: una venta con lo pedido (precios vigentes) que descuenta el
   * inventario y deja la mesa libre. Mismo cobro que `vender` (descuento, pago mixto, cambio).
   */
  async cobrarCuenta(v: {
    cuentaId: string;
    descuento?: Descuento | null;
    pagos: readonly PagoPedido[];
    recibido?: Centavos | null;
  }): Promise<Evento> {
    if (v.descuento && v.descuento.valor > 0) this.exigir('venta.descuento');
    return this.ejecutar((estado) => {
      const c = estado.cuentas[v.cuentaId];
      if (!c) throw new ReglaRota('Esa cuenta ya se cobró o no existe.');
      if (c.lineas.length === 0) throw new ReglaRota('La cuenta está vacía: no hay nada que cobrar. Libera la mesa.');
      for (const l of c.lineas) {
        const p = estado.productos[l.productoId];
        if (!p?.activo) throw new ReglaRota(`«${p?.nombre ?? 'Un producto'}» se archivó: quítalo de la cuenta (con su motivo) y cobra el resto.`);
      }
      return armarVenta(estado, { ...v, lineas: c.lineas }, c.id);
    });
  }

  anularVenta(ventaId: string, motivo: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'venta.anulada', datos: { ventaId, motivo: motivo.trim() } });
  }

  // --- Mesas y cuentas ----------------------------------------------------------

  crearMesa(m: { nombre: string; zona: string }): Promise<Evento> {
    return this.ejecutar({ tipo: 'mesa.creada', datos: { nombre: m.nombre.trim(), zona: m.zona.trim() || 'Salón' } });
  }

  /** Crea varias mesas numeradas de una vez («Mesa 1» … «Mesa 10»), saltando los nombres que ya existen. */
  async crearMesas(m: { prefijo: string; desde: number; hasta: number; zona: string }): Promise<Evento[]> {
    const prefijo = m.prefijo.trim() || 'Mesa';
    if (!Number.isSafeInteger(m.desde) || !Number.isSafeInteger(m.hasta) || m.desde < 1 || m.hasta < m.desde) {
      throw new ReglaRota('Escribe del número menor al mayor (por ejemplo, de 1 a 10).');
    }
    if (m.hasta - m.desde >= 50) throw new ReglaRota('Crea hasta 50 mesas a la vez.');
    return this.ejecutarVarios((estado) => {
      const usados = new Set(Object.values(estado.mesas).filter((x) => x.activa).map((x) => x.nombre.toLocaleLowerCase('es')));
      const cmds: Comando[] = [];
      for (let n = m.desde; n <= m.hasta; n++) {
        const nombre = `${prefijo} ${n}`;
        if (!usados.has(nombre.toLocaleLowerCase('es'))) cmds.push({ tipo: 'mesa.creada', datos: { nombre, zona: m.zona.trim() || 'Salón' } });
      }
      if (cmds.length === 0) throw new ReglaRota('Esas mesas ya existen.');
      return cmds;
    });
  }

  retirarMesa(mesaId: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'mesa.retirada', datos: { mesaId } });
  }

  abrirCuenta(mesaId: string, personas?: number | null): Promise<Evento> {
    return this.ejecutar({ tipo: 'cuenta.abierta', datos: sinIndefinidos({ mesaId, personas: personas ?? undefined }) });
  }

  /**
   * Pide una ronda en la mesa. Si la mesa está libre, abre la cuenta y pide en UNA sola
   * escritura (todo o nada). Líneas repetidas se suman.
   */
  async pedirEnMesa(mesaId: string, lineas: readonly LineaPedida[], opciones: { nota?: string | null; personas?: number | null } = {}): Promise<Evento[]> {
    const cantidades = new Map<string, number>();
    for (const l of lineas) cantidades.set(l.productoId, (cantidades.get(l.productoId) ?? 0) + l.cantidad);
    const ronda = [...cantidades].map(([productoId, cantidad]) => {
      if (cantidad <= 0) throw new ReglaRota('Cada producto de la ronda lleva una cantidad mayor que cero.');
      return { productoId, cantidad: milesimas(cantidad) };
    });
    if (ronda.length === 0) throw new ReglaRota('La ronda está vacía: toca los productos que pidieron.');
    const nota = opcional(opciones.nota);
    return this.ejecutarVarios((estado, nuevoId) => {
      const abierta = Object.values(estado.cuentas).find((c) => c.mesaId === mesaId);
      const cmds: Comando[] = [];
      let cuentaId = abierta?.id;
      if (!cuentaId) {
        cuentaId = nuevoId(0);
        cmds.push({ tipo: 'cuenta.abierta', datos: sinIndefinidos({ mesaId, personas: opciones.personas ?? undefined }) });
      }
      cmds.push({ tipo: 'cuenta.pedido', datos: sinIndefinidos({ cuentaId, lineas: ronda, nota }) });
      return cmds;
    });
  }

  quitarDeCuenta(q: { cuentaId: string; productoId: string; cantidad: Milesimas; motivo: string }): Promise<Evento> {
    return this.ejecutar({ tipo: 'cuenta.quitado', datos: { ...q, motivo: q.motivo.trim() } });
  }

  marcarPrecuenta(cuentaId: string, pedida: boolean): Promise<Evento> {
    return this.ejecutar({ tipo: 'cuenta.precuenta', datos: { cuentaId, pedida } });
  }

  trasladarCuenta(cuentaId: string, mesaId: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'cuenta.trasladada', datos: { cuentaId, mesaId } });
  }

  liberarMesa(cuentaId: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'cuenta.liberada', datos: { cuentaId } });
  }

  anularCuenta(cuentaId: string, motivo: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'cuenta.anulada', datos: { cuentaId, motivo: motivo.trim() } });
  }

  // --- Productos e inventario ---------------------------------------------------

  crearProducto(p: NuevoProducto): Promise<Evento> {
    const datos: DatosProducto = {
      nombre: p.nombre.trim(),
      categoria: p.categoria.trim() || 'Sin categoría',
      unidad: p.unidad,
      precio: p.precio,
      costo: p.costo ?? null,
      stockMinimo: p.stockMinimo ?? null,
      codigo: opcional(p.codigo) ?? null,
    };
    return this.ejecutar({ tipo: 'producto.creado', datos });
  }

  /** Cambia sólo lo que se pasa. Precio o costo exigen el permiso del dueño. */
  editarProducto(productoId: string, cambios: Partial<NuevoProducto>): Promise<Evento> {
    const c: Record<string, unknown> = {};
    if (cambios.nombre !== undefined) c.nombre = cambios.nombre.trim();
    if (cambios.categoria !== undefined) c.categoria = cambios.categoria.trim() || 'Sin categoría';
    if (cambios.unidad !== undefined) c.unidad = cambios.unidad;
    if (cambios.precio !== undefined) c.precio = cambios.precio;
    if (cambios.costo !== undefined) c.costo = cambios.costo;
    if (cambios.stockMinimo !== undefined) c.stockMinimo = cambios.stockMinimo;
    if (cambios.codigo !== undefined) c.codigo = opcional(cambios.codigo) ?? null;
    return this.ejecutar({ tipo: 'producto.editado', datos: { productoId, cambios: c as Partial<DatosProducto> } });
  }

  archivarProducto(productoId: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'producto.archivado', datos: { productoId } });
  }

  /** Ajuste manual (merma, consumo, corrección, importación). Para conteos, `contar`. */
  ajustarInventario(a: { productoId: string; delta: Milesimas; motivo: Exclude<MotivoAjuste, 'conteo'>; nota?: string | null }): Promise<Evento> {
    return this.ejecutar((estado) => {
      if ((a.motivo as MotivoAjuste) === 'conteo') throw new ReglaRota('Para un conteo usa «Contar».');
      const antes = stockDe(estado, a.productoId);
      return {
        tipo: 'inventario.ajuste',
        datos: sinIndefinidos({
          productoId: a.productoId,
          delta: a.delta,
          motivo: a.motivo,
          antes,
          despues: milesimas(antes + a.delta),
          nota: opcional(a.nota),
        }),
      };
    });
  }

  /**
   * Conteo físico: deja la existencia en `contado` y guarda cuánto había y la diferencia.
   * `antesVisto`: la existencia que veía la persona al empezar a contar; si cambió (se
   * vendió algo mientras tanto), se rechaza y hay que volver a contar.
   */
  contar(productoId: string, contado: Milesimas, opciones: { nota?: string | null; antesVisto?: Milesimas } = {}): Promise<Evento> {
    return this.ejecutar((estado) => {
      const actual = stockDe(estado, productoId);
      const antes = opciones.antesVisto ?? actual;
      return {
        tipo: 'inventario.ajuste',
        datos: sinIndefinidos({
          productoId,
          delta: milesimas(contado - antes),
          motivo: 'conteo' as const,
          antes,
          despues: contado,
          nota: opcional(opciones.nota),
        }),
      };
    });
  }

  // --- Compras y pagos ----------------------------------------------------------

  /** Registra la factura del proveedor (no toca el stock: eso es `aplicarCompra`). */
  registrarCompra(c: NuevaCompra): Promise<Evento> {
    const total = centavos(c.lineas.reduce((s, l) => s + importe(l.cantidad, l.costoUnit), 0));
    return this.ejecutar({
      tipo: 'compra.registrada',
      datos: sinIndefinidos({
        proveedor: c.proveedor.trim(),
        numero: c.numero.trim(),
        fecha: c.fecha,
        vence: opcional(c.vence),
        lineas: c.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, costoUnit: l.costoUnit })),
        total,
        adjuntos: [...(c.adjuntos ?? [])],
        nota: opcional(c.nota),
      }),
    });
  }

  /** La única puerta de la mercancía: suma el stock y fija el último costo. Una sola vez. */
  aplicarCompra(compraId: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'compra.aplicada', datos: { compraId } });
  }

  anularCompra(compraId: string, motivo: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'compra.anulada', datos: { compraId, motivo: motivo.trim() } });
  }

  pagarFactura(p: { compraId: string; monto: Centavos; forma: FormaEgreso; deCaja: boolean }): Promise<Evento> {
    return this.ejecutar({ tipo: 'pago.factura', datos: { compraId: p.compraId, monto: p.monto, forma: p.forma, deCaja: p.deCaja } });
  }

  // --- Gastos ------------------------------------------------------------------------

  registrarGasto(g: NuevoGasto): Promise<Evento> {
    return this.ejecutar({
      tipo: 'gasto.registrado',
      datos: sinIndefinidos({
        categoria: g.categoria.trim(),
        descripcion: g.descripcion.trim(),
        monto: g.monto,
        forma: g.forma,
        deCaja: g.deCaja,
        adjunto: opcional(g.adjunto),
      }),
    });
  }

  anularGasto(gastoId: string, motivo: string): Promise<Evento> {
    return this.ejecutar({ tipo: 'gasto.anulado', datos: { gastoId, motivo: motivo.trim() } });
  }

  // --- Usuarios ------------------------------------------------------------------------

  /**
   * Crea un usuario. En el primer uso no pide sesión, el cargo es siempre dueño y la
   * sesión queda abierta con él.
   */
  async crearUsuario(u: { nombre: string; rol: Rol; pin: string }): Promise<Evento> {
    validarFormatoPin(u.pin);
    const primero = this.primerUso;
    if (!primero) this.exigir('usuario.crear');
    const pin = await hashPin(u.pin, this.iteracionesPin);
    const evento = await this.ejecutar({
      tipo: 'usuario.creado',
      datos: { nombre: u.nombre.trim(), rol: primero ? 'dueno' : u.rol, pin },
    });
    if (primero) {
      this.sesionId = evento.id;
      this.avisar(null);
    }
    return evento;
  }

  /**
   * Cambia un PIN. El propio exige el PIN actual; el de otra persona, ser dueño.
   */
  async cambiarPin(usuarioId: string, pinNuevo: string, pinActual?: string): Promise<Evento> {
    validarFormatoPin(pinNuevo);
    const yo = this.sesion;
    if (yo && yo.id === usuarioId) {
      const u = this.estado.usuarios[usuarioId];
      if (!u || pinActual === undefined || !(await verificarPin(pinActual, u.pin))) {
        throw new ReglaRota('El PIN actual no es correcto.');
      }
    } else {
      this.exigir('usuario.cambiarPinOtro');
    }
    const pin = await hashPin(pinNuevo, this.iteracionesPin);
    return this.ejecutar({ tipo: 'usuario.pin', datos: { usuarioId, pin } });
  }

  async desactivarUsuario(usuarioId: string): Promise<Evento> {
    const evento = await this.ejecutar({ tipo: 'usuario.desactivado', datos: { usuarioId } });
    if (usuarioId === this.sesionId) this.cerrarSesion();
    return evento;
  }

  // --- Consultas -------------------------------------------------------------------------

  /** Eventos de los días del rango (para historiales). Requiere ver la contabilidad. */
  async eventos(rango: { desde?: string; hasta?: string } = {}): Promise<Evento[]> {
    this.exigir('contabilidad.ver');
    return this.diario.eventos(rango);
  }

  /** Resumen contable del período (lee el diario desde `desde` en adelante). */
  async contabilidad(periodo: Periodo): Promise<Resumen> {
    this.exigir('contabilidad.ver');
    // Desde `desde` hasta hoy: así se ven anulaciones posteriores al período.
    const eventos = await this.diario.eventos({ desde: periodo.desde });
    return resumen(eventos, this.estado, periodo);
  }

  /** Rastro de existencias de un producto en el rango. */
  async movimientosStock(productoId: string, rango: { desde?: string; hasta?: string } = {}): Promise<MovimientoStock[]> {
    this.exigir('inventario.ver');
    return movimientosStock(await this.diario.eventos(rango), productoId, this.estado);
  }

  /**
   * Movimientos de plata de la caja abierta (entradas, retiros, gastos y pagos desde la caja),
   * para quien maneja la caja aunque no vea la contabilidad. Lo más reciente primero.
   */
  async movimientosCaja(): Promise<MovimientoCaja[]> {
    this.exigir('caja.movimiento');
    const caja = this.estado.caja;
    if (!caja) return [];
    const lista: MovimientoCaja[] = [];
    const eventos = await this.diario.eventos({ desde: diaDe({ en: caja.abiertaEn }) });
    const inicio = eventos.findIndex((e) => e.tipo === 'caja.abierta' && e.id === caja.id);
    for (const e of inicio < 0 ? [] : eventos.slice(inicio + 1)) {
      const por = this.estado.usuarios[e.por]?.nombre ?? '';
      if (e.tipo === 'caja.movimiento') {
        lista.push({ id: e.id, en: e.en, por, tipo: e.datos.tipo, monto: e.datos.monto, detalle: e.datos.motivo });
      } else if (e.tipo === 'gasto.registrado' && e.datos.deCaja) {
        lista.push({ id: e.id, en: e.en, por, tipo: 'gasto', monto: e.datos.monto, detalle: e.datos.descripcion });
      } else if (e.tipo === 'pago.factura' && e.datos.deCaja) {
        const compra = this.estado.compras[e.datos.compraId];
        lista.push({ id: e.id, en: e.en, por, tipo: 'pago', monto: e.datos.monto, detalle: compra ? `${compra.proveedor} ${compra.numero}` : 'Factura' });
      }
    }
    return lista.reverse();
  }

  /** Recorre todo el diario y comprueba la cadena de hashes. */
  async verificar(): Promise<Verificacion> {
    this.exigir('diario.verificar');
    return this.diario.verificar();
  }
}

function recortar(t: string, max: number): string {
  return t.trim().slice(0, max).trim();
}

/** Unidad escrita en el archivo → unidad de la app (lo desconocido cuenta como «unidad»). */
function unidadDe(texto: string | undefined): Unidad {
  const t = (texto ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (['g', 'gr', 'gramo', 'gramos'].includes(t)) return 'g';
  if (['kg', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(t)) return 'kg';
  if (['ml', 'mililitro', 'mililitros', 'cc'].includes(t)) return 'ml';
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(t)) return 'L';
  return 'unidad';
}

function mensajeEspera(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s < 60 ? `Demasiados intentos. Espera ${s} s.` : `Demasiados intentos. Espera ${Math.ceil(s / 60)} min.`;
}

/** Completa el pago «sin monto» con el resto y comprueba lo básico. */
function repartirPagos(pagos: readonly PagoPedido[], total: Centavos): PagoVenta[] {
  if (pagos.length === 0) throw new ReglaRota('Falta la forma de pago.');
  const sinMonto = pagos.filter((p) => p.monto === undefined);
  if (sinMonto.length > 1) throw new ReglaRota('Sólo una forma de pago puede ir sin valor (el resto).');
  const conMonto = pagos.reduce((s, p) => s + (p.monto ?? 0), 0);
  return pagos.map((p) => {
    const monto = p.monto ?? total - conMonto;
    if (monto <= 0) throw new ReglaRota('Cada forma de pago debe tener un valor mayor que cero.');
    return { forma: p.forma, monto: centavos(monto) };
  });
}

/**
 * Arma la venta con los precios vigentes: líneas, descuento, total, pagos y cambio. La regla
 * (`estado.validar`) vuelve a comprobarlo todo al escribir.
 */
function armarVenta(
  estado: EstadoNegocio,
  v: { lineas: readonly LineaPedida[]; descuento?: Descuento | null; pagos: readonly PagoPedido[]; recibido?: Centavos | null },
  cuentaId?: string,
): Comando {
  const caja = estado.caja;
  if (!caja) throw new ReglaRota('No hay caja abierta. Abre la caja antes de vender.');
  if (v.lineas.length === 0) throw new ReglaRota('La venta está vacía.');
  const cantidades = new Map<string, number>();
  for (const l of v.lineas) cantidades.set(l.productoId, (cantidades.get(l.productoId) ?? 0) + l.cantidad);
  const lineas: LineaVenta[] = [...cantidades].map(([productoId, cantidad]) => {
    const p = estado.productos[productoId];
    if (!p || !p.activo) throw new ReglaRota('Un producto de la venta ya no está disponible.');
    if (cantidad <= 0) throw new ReglaRota(`La cantidad de «${p.nombre}» debe ser mayor que cero.`);
    const q = milesimas(cantidad);
    return { productoId, nombre: p.nombre, cantidad: q, precioUnit: p.precio, subtotal: importe(q, p.precio) };
  });
  const bruto = centavos(lineas.reduce((s, l) => s + l.subtotal, 0));
  const d = v.descuento ? aplicarDescuento(bruto, v.descuento) : null;
  const total = d ? d.total : bruto;
  const pagos = total === 0 ? [] : repartirPagos(v.pagos, total);
  const efectivo = pagos.find((p) => p.forma === 'efectivo')?.monto;
  const recibido = v.recibido ?? undefined;
  if (recibido !== undefined && efectivo !== undefined && recibido < efectivo) {
    throw new ReglaRota(`Recibiste ${pesos(recibido)}, menos que el efectivo a pagar (${pesos(efectivo)}).`);
  }
  return {
    tipo: 'venta.registrada',
    datos: sinIndefinidos({
      cajaId: caja.id,
      lineas,
      descuento: d && v.descuento && d.monto > 0 ? { tipo: v.descuento.tipo, valor: v.descuento.valor, monto: d.monto } : undefined,
      total,
      pagos,
      recibido,
      cambio: recibido !== undefined && efectivo !== undefined ? centavos(recibido - efectivo) : undefined,
      cuentaId,
    }),
  };
}
