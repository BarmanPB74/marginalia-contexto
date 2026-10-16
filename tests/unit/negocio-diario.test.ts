import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import {
  canonico,
  Diario,
  DiarioDanado,
  HASH_INICIAL,
  Negocio,
  RUTA_INSTANTANEA,
  sha256,
  stockDe,
} from '../../src/core/negocio';
import { $, abrir, montar, u, type Montaje } from './negocio-ayuda';

const ruta = (dia: string) => `negocio/diario/${dia}.json`;

async function leerDia(m: Montaje, dia: string): Promise<Record<string, unknown>[]> {
  return JSON.parse((await m.disco.leer(ruta(dia))) ?? 'null') as Record<string, unknown>[];
}

async function escribirDia(m: Montaje, dia: string, registros: unknown) {
  await m.disco.escribir(ruta(dia), JSON.stringify(registros));
}

/** Un día de trabajo: stock, caja, dos ventas, cierre; y al día siguiente, una venta más. */
async function dosDias(m: Montaje) {
  await m.negocio.ajustarInventario({ productoId: m.cerveza, delta: u(24), motivo: 'correccion' });
  await m.negocio.abrirCaja($(50000));
  await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(2) }], pagos: [{ forma: 'efectivo' }] });
  await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(1) }, { productoId: m.cafe, cantidad: u(1) }], pagos: [{ forma: 'tarjeta' }] });
  await m.negocio.cerrarCaja({ contado: $(67000), confirmar: true });
  m.reloj.avanzar(24 * 60);
  await m.negocio.abrirCaja($(10000));
  await m.negocio.vender({ lineas: [{ productoId: m.cerveza, cantidad: u(3) }], pagos: [{ forma: 'efectivo' }] });
}

describe('diario encadenado', () => {
  it('guarda un arreglo por día local y encadena con SHA-256 desde 64 ceros', async () => {
    const m = await montar();
    await dosDias(m);
    expect(await m.almacen.listar('negocio/diario')).toEqual(['2026-10-16.json', '2026-10-17.json']);
    const dia1 = await leerDia(m, '2026-10-16');
    const dia2 = await leerDia(m, '2026-10-17');
    expect(dia1.length + dia2.length).toBe(m.negocio.estado.eventos);
    const primero = dia1[0] as Record<string, unknown>;
    const { hash, ...sinHash } = primero;
    expect(hash).toBe(await sha256(HASH_INICIAL + canonico(sinHash)));
    expect(primero.tipo).toBe('usuario.creado');
    expect(JSON.stringify(primero)).not.toContain('"1234"'); // el PIN nunca
    expect((dia2[dia2.length - 1] as { hash: string }).hash).toBe(m.negocio.estado.ultimoHash);
  });

  it('canonico ordena claves en todos los niveles', () => {
    expect(canonico({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,{"y":2,"z":1}]},"b":1}');
  });

  it('verificar() pasa en un diario sano', async () => {
    const m = await montar();
    await dosDias(m);
    const v = await m.negocio.verificar();
    expect(v).toEqual({ ok: true, eventos: m.negocio.estado.eventos, ultimoHash: m.negocio.estado.ultimoHash });
  });

  it('detecta un evento alterado: verificar dice dónde', async () => {
    const m = await montar();
    await dosDias(m);
    const dia1 = await leerDia(m, '2026-10-16');
    const i = dia1.findIndex((r) => r.tipo === 'caja.abierta');
    (dia1[i] as { datos: { base: number } }).datos.base = 1; // alguien "corrige" la base
    await escribirDia(m, '2026-10-16', dia1);
    const v = await new Diario(m.almacen).verificar();
    expect(v).toMatchObject({ ok: false, archivo: '2026-10-16.json', indice: i, eventoId: dia1[i]?.id });
    // Antes de la instantánea la carga rápida no lo repite (para eso está verificar);
    // sin instantánea, la carga también se niega.
    await m.disco.borrar(RUTA_INSTANTANEA);
    await expect(abrir(m.almacen, m.reloj)).rejects.toThrow(DiarioDanado);
  });

  it('un evento alterado después de la instantánea bloquea la carga y la escritura', async () => {
    const m = await montar();
    await dosDias(m);
    const dia2 = await leerDia(m, '2026-10-17');
    (dia2[0] as { datos: { base: number } }).datos.base = 999;
    await escribirDia(m, '2026-10-17', dia2);
    await expect(abrir(m.almacen, m.reloj)).rejects.toThrow('la cadena de hashes no cuadra');
    const d = new Diario(m.almacen);
    await expect(d.cargar()).rejects.toThrow(DiarioDanado);
    await expect(d.agregar(() => { throw new Error('no debería llegar aquí'); })).rejects.toThrow(DiarioDanado);
  });

  it('detecta un evento borrado del medio', async () => {
    const m = await montar();
    await dosDias(m);
    const dia1 = await leerDia(m, '2026-10-16');
    const borrado = dia1.findIndex((r) => r.tipo === 'venta.registrada');
    dia1.splice(borrado, 1);
    await escribirDia(m, '2026-10-16', dia1);
    const v = await new Diario(m.almacen).verificar();
    expect(v).toMatchObject({ ok: false, archivo: '2026-10-16.json', indice: borrado });
  });

  it('detecta eventos quitados al final (la instantánea apunta a uno que ya no está)', async () => {
    const m = await montar();
    await dosDias(m);
    await m.disco.borrar(ruta('2026-10-17'));
    const dia1 = await leerDia(m, '2026-10-16');
    await escribirDia(m, '2026-10-16', dia1.slice(0, -1)); // quita el cierre de caja
    expect((await new Diario(m.almacen).verificar()).ok).toBe(false);
    await expect(abrir(m.almacen, m.reloj)).rejects.toThrow('faltan eventos');
    // La sesión abierta también lo nota.
    expect((await m.negocio.verificar()).ok).toBe(false);
  });

  it('un archivo ilegible detiene la carga con un error claro', async () => {
    const m = await montar();
    await m.disco.escribir(ruta('2026-10-16'), '{roto');
    await expect(abrir(m.almacen, m.reloj)).rejects.toThrow('no es JSON válido');
    await m.disco.escribir(ruta('2026-10-16'), JSON.stringify([{ id: 'x', hash: 'y' }]));
    await expect(abrir(m.almacen, m.reloj)).rejects.toThrow(DiarioDanado);
  });

  it('reiniciar desde la instantánea da el mismo estado que repetir todo', async () => {
    const m = await montar();
    await dosDias(m);
    const inst = JSON.parse((await m.disco.leer(RUTA_INSTANTANEA)) ?? 'null') as { hastaId: string };
    expect(inst.hastaId).toBeTruthy();
    const conAtajo = await abrir(m.almacen, m.reloj);
    expect(conAtajo.estado).toEqual(m.negocio.estado);
    await m.disco.borrar(RUTA_INSTANTANEA);
    const sinAtajo = await abrir(m.almacen, m.reloj);
    expect(sinAtajo.estado).toEqual(m.negocio.estado);
    expect(stockDe(sinAtajo.estado, m.cerveza)).toBe(u(18));
    // Una instantánea dañada se ignora (es sólo un atajo).
    await m.disco.escribir(RUTA_INSTANTANEA, 'basura');
    expect((await abrir(m.almacen, m.reloj)).estado).toEqual(m.negocio.estado);
  });

  it('se puede seguir escribiendo tras reabrir y la cadena sigue sana', async () => {
    const m = await montar();
    await dosDias(m);
    const otra = await abrir(m.almacen, m.reloj);
    expect((await otra.iniciarSesion(m.dueno.id, '1234')).ok).toBe(true);
    await otra.vender({ lineas: [{ productoId: m.cafe, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }] });
    expect((await otra.verificar()).ok).toBe(true);
  });

  it('si el reloj retrocede, el evento va al último día (el orden de archivos es el de la cadena)', async () => {
    const m = await montar();
    m.reloj.avanzar(24 * 60);
    await m.negocio.abrirCaja($(0));
    m.reloj.avanzar(-48 * 60);
    await m.negocio.movimientoCaja({ tipo: 'ingreso', monto: $(1), motivo: 'reloj atrasado' });
    expect(await m.almacen.listar('negocio/diario')).toEqual(['2026-10-16.json', '2026-10-17.json']);
    expect((await leerDia(m, '2026-10-17')).map((r) => r.tipo)).toEqual(['caja.abierta', 'caja.movimiento']);
    expect((await abrir(m.almacen, m.reloj)).estado).toEqual(m.negocio.estado);
  });

  it('operaciones simultáneas van en fila: ninguna se pisa', async () => {
    const m = await montar();
    await m.negocio.abrirCaja($(0));
    await Promise.all(
      Array.from({ length: 10 }, () => m.negocio.vender({ lineas: [{ productoId: m.cafe, cantidad: u(1) }], pagos: [{ forma: 'efectivo' }] })),
    );
    expect(stockDe(m.negocio.estado, m.cafe)).toBe(u(-10));
    expect(m.negocio.resumenCierre()?.esperado).toBe($(40000));
    expect((await m.negocio.verificar()).ok).toBe(true);
  });

  it('si una escritura falla, el diario se bloquea hasta recargar', async () => {
    class DiscoFragil extends DiscoMemoria {
      fallar = false;
      override async escribir(r: string, c: string) {
        if (this.fallar) throw new Error('disco lleno');
        await super.escribir(r, c);
      }
    }
    const disco = new DiscoFragil();
    const almacen = crearAlmacen(disco);
    const negocio = await Negocio.crear(almacen, { iteracionesPin: 1 });
    await negocio.crearUsuario({ nombre: 'D', rol: 'dueno', pin: '1234' });
    disco.fallar = true;
    await expect(negocio.abrirCaja($(0))).rejects.toThrow('disco lleno');
    disco.fallar = false;
    await expect(negocio.abrirCaja($(0))).rejects.toThrow(DiarioDanado);
    expect(negocio.estado.caja).toBeNull();
    // Al reabrir, todo sigue coherente.
    const otra = await Negocio.crear(almacen, { iteracionesPin: 1 });
    expect(otra.estado.eventos).toBe(1);
  });
});
