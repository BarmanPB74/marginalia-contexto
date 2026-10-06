import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { claveDelKeystore, ClavePerdida, RUTA_CLAVE, type Envoltorio } from '../../src/core/almacen/boveda';
import {
  CABECERA,
  CABECERA_V2,
  cifrarPendientes,
  cifrarTexto,
  discoCifrado,
  NoSePuedeDescifrar,
  quedanConCabecera,
} from '../../src/core/almacen/cifrado';

/** Keystore simulado: "envuelve" con una clave AES propia que nunca sale de aquí. */
function keystoreFalso(): Envoltorio & { llamadas: number } {
  const interna = crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
  const de = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  const k = {
    llamadas: 0,
    async envolver(clave: string) {
      k.llamadas++;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await interna, de(clave)));
      return b64(new Uint8Array([...iv, ...c]));
    },
    async desenvolver(envuelta: string) {
      const t = de(envuelta);
      return b64(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: t.subarray(0, 12) }, await interna, t.subarray(12))));
    },
  };
  return k;
}

const claveV1 = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

describe('clave envuelta por Android Keystore (ADR-014)', () => {
  it('la crea una vez, en disco solo queda envuelta, y la siguiente apertura descifra lo mismo', async () => {
    const disco = new DiscoMemoria();
    const ks = keystoreFalso();
    const k1 = await claveDelKeystore(crearAlmacen(disco), disco, ks);
    expect(k1.extractable).toBe(false);
    const envuelta = await disco.leer(RUTA_CLAVE);
    expect(envuelta).toMatch(/^[A-Za-z0-9+/=]+$/);
    const cifrada = await cifrarTexto(k1, 'secreto', 'notas/a.md', CABECERA_V2);
    // "Reiniciar la app": misma carpeta, mismo Keystore
    const k2 = await claveDelKeystore(crearAlmacen(disco), disco, ks);
    const d = new DiscoMemoria();
    await d.escribir('notas/a.md', cifrada);
    expect(await discoCifrado(d, { escribir: 'v2', v2: async () => k2 }).leer('notas/a.md')).toBe('secreto');
    expect(ks.llamadas).toBe(1);
  });

  it('con otro Keystore (copia de los archivos a otro teléfono) no se abre', async () => {
    const disco = new DiscoMemoria();
    await claveDelKeystore(crearAlmacen(disco), disco, keystoreFalso());
    await expect(claveDelKeystore(crearAlmacen(disco), disco, keystoreFalso())).rejects.toThrow();
  });

  it('si faltara la clave pero hay notas v2, no crea otra (las dejaría ilegibles)', async () => {
    const disco = new DiscoMemoria();
    await disco.escribir('notas/a.md', `${CABECERA_V2}AAAA`);
    await expect(claveDelKeystore(crearAlmacen(disco), disco, keystoreFalso())).rejects.toBeInstanceOf(ClavePerdida);
    expect(await disco.leer(RUTA_CLAVE)).toBeNull();
  });

  it('si el Keystore no devuelve lo mismo, no guarda nada', async () => {
    const disco = new DiscoMemoria();
    const roto: Envoltorio = { envolver: async () => 'AAAA', desenvolver: async () => 'BBBB' };
    await expect(claveDelKeystore(crearAlmacen(disco), disco, roto)).rejects.toThrow();
    expect(await disco.leer(RUTA_CLAVE)).toBeNull();
  });
});

describe('migración v1 → v2', () => {
  it('cada nota v1 (y en claro) pasa a v2; un corte a medias deja todo legible; al final no queda v1', async () => {
    const crudo = new DiscoMemoria();
    const k1 = await claveV1();
    const k2 = await claveDelKeystore(crearAlmacen(crudo), crudo, keystoreFalso());
    const viejo = crearAlmacen(discoCifrado(crudo, async () => k1));
    for (const id of ['a', 'b', 'c']) await viejo.escribir(`notas/${id}.md`, `nota ${id}`);
    await crudo.escribir('notas/d.md', 'en claro');
    const almacen = crearAlmacen(discoCifrado(crudo, { escribir: 'v2', v1: async () => k1, v2: async () => k2 }));
    const escribir = (r: string, t: string) => almacen.escribir(r, t);
    const leerClaro = (r: string) => almacen.leer(r);

    // Corte simulado: solo una nota migró
    await almacen.escribir('notas/a.md', (await almacen.leer('notas/a.md')) ?? '');
    for (const id of ['a', 'b', 'c']) expect(await almacen.leer(`notas/${id}.md`)).toBe(`nota ${id}`);
    expect((await crudo.leer('notas/a.md'))?.startsWith(CABECERA_V2)).toBe(true);
    expect((await crudo.leer('notas/b.md'))?.startsWith(CABECERA)).toBe(true);

    expect(await cifrarPendientes(crudo, escribir, 'notas', { destino: CABECERA_V2, leerClaro })).toBe(3);
    expect(await quedanConCabecera(crudo, 'notas', CABECERA)).toBe(false);
    // Sin la clave v1 todo se sigue leyendo
    const soloV2 = crearAlmacen(discoCifrado(crudo, { escribir: 'v2', v1: async () => null, v2: async () => k2 }));
    for (const id of ['a', 'b', 'c']) expect(await soloV2.leer(`notas/${id}.md`)).toBe(`nota ${id}`);
    expect(await soloV2.leer('notas/d.md')).toBe('en claro');
    expect(await cifrarPendientes(crudo, escribir, 'notas', { destino: CABECERA_V2, leerClaro })).toBe(0);
  });

  it('una nota v1 que no se puede descifrar se deja como está y la clave v1 no se da por sobrante', async () => {
    const crudo = new DiscoMemoria();
    const k2 = await claveV1();
    await crudo.escribir('notas/rota.md', `${CABECERA}no-es-base64-valido`);
    const almacen = crearAlmacen(discoCifrado(crudo, { escribir: 'v2', v1: async () => claveV1(), v2: async () => k2 }));
    const n = await cifrarPendientes(crudo, (r, t) => almacen.escribir(r, t), 'notas', {
      destino: CABECERA_V2,
      leerClaro: (r) => almacen.leer(r),
    });
    expect(n).toBe(0);
    expect(await quedanConCabecera(crudo, 'notas', CABECERA)).toBe(true);
    await expect(almacen.leer('notas/rota.md')).rejects.toBeInstanceOf(NoSePuedeDescifrar);
  });

  it('una v2 sin su clave no se descifra (nunca se intenta con la v1)', async () => {
    const crudo = new DiscoMemoria();
    const k = await claveV1();
    await crudo.escribir('notas/a.md', await cifrarTexto(k, 'x', 'notas/a.md', CABECERA_V2));
    await expect(discoCifrado(crudo, async () => k).leer('notas/a.md')).rejects.toBeInstanceOf(NoSePuedeDescifrar);
  });
});
