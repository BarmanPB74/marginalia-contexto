import { describe, expect, it } from 'vitest';
import { hashPin, igualesEnTiempoConstante, Limitador, ReglaRota, validarFormatoPin, verificarPin } from '../../src/core/negocio';
import { montar } from './negocio-ayuda';

describe('PIN', () => {
  it('sólo de 4 a 8 dígitos', () => {
    for (const bueno of ['1234', '00000000']) expect(() => validarFormatoPin(bueno)).not.toThrow();
    for (const malo of ['123', '123456789', '12a4', ' 1234', '', '１２３４']) expect(() => validarFormatoPin(malo), malo).toThrow(ReglaRota);
  });

  it('guarda sal y hash, nunca el PIN; verifica sólo el correcto', async () => {
    const g = await hashPin('4321', 10);
    expect(g.iteraciones).toBe(10);
    expect(atob(g.sal)).toHaveLength(16);
    expect(atob(g.hash)).toHaveLength(32);
    expect(JSON.stringify(g)).not.toContain('4321');
    expect(await verificarPin('4321', g)).toBe(true);
    expect(await verificarPin('4322', g)).toBe(false);
    expect(await verificarPin('abc', g)).toBe(false);
    // La sal es aleatoria: el mismo PIN da hashes distintos.
    expect((await hashPin('4321', 10)).hash).not.toBe(g.hash);
  });

  it('por defecto usa 210 000 iteraciones', async () => {
    const m = await import('../../src/core/negocio');
    expect(m.ITERACIONES_PIN).toBe(210_000);
  });

  it('datos dañados u hostiles no verifican (ni cuelgan)', async () => {
    const g = await hashPin('1234', 5);
    expect(await verificarPin('1234', { ...g, hash: '%%%' })).toBe(false);
    expect(await verificarPin('1234', { ...g, iteraciones: 1e9 })).toBe(false);
    expect(await verificarPin('1234', { ...g, iteraciones: 6 })).toBe(false);
  });

  it('comparación en tiempo constante', () => {
    expect(igualesEnTiempoConstante(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(igualesEnTiempoConstante(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(igualesEnTiempoConstante(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBe(false);
    expect(igualesEnTiempoConstante(new Uint8Array([]), new Uint8Array([]))).toBe(true);
  });
});

describe('Limitador', () => {
  it('cinco fallos y luego espera creciente con tope', () => {
    const l = new Limitador({ fallosPermitidos: 5, esperaBaseMs: 30_000, esperaMaxMs: 100_000 });
    for (let i = 0; i < 4; i++) expect(l.registrarFallo('ana', 0).permitido).toBe(true);
    expect(l.registrarFallo('ana', 0)).toEqual({ permitido: false, esperaMs: 30_000 });
    expect(l.puedeIntentar('ana', 29_999).permitido).toBe(false);
    expect(l.puedeIntentar('ana', 30_000).permitido).toBe(true);
    expect(l.registrarFallo('ana', 30_000)).toEqual({ permitido: false, esperaMs: 60_000 });
    expect(l.registrarFallo('ana', 90_000)).toEqual({ permitido: false, esperaMs: 100_000 }); // tope
    expect(l.puedeIntentar('beto', 0).permitido).toBe(true); // cada usuario cuenta aparte
    l.registrarExito('ana');
    expect(l.fallos('ana')).toBe(0);
    expect(l.puedeIntentar('ana', 90_001).permitido).toBe(true);
  });

  it('exporta e importa su estado', () => {
    const l = new Limitador();
    for (let i = 0; i < 5; i++) l.registrarFallo('ana', 1000);
    const otro = new Limitador();
    otro.importar(JSON.parse(JSON.stringify(l.exportar())));
    expect(otro.puedeIntentar('ana', 1000).permitido).toBe(false);
    otro.importar({ x: { fallos: 'mucho' } });
    expect(otro.fallos('x')).toBe(0);
  });

  it('el servicio bloquea tras cinco PIN errados, aunque luego llegue el correcto', async () => {
    const m = await montar();
    const id = m.dueno.id;
    for (let i = 0; i < 4; i++) expect((await m.negocio.iniciarSesion(id, '0000')).ok).toBe(false);
    const quinto = await m.negocio.iniciarSesion(id, '0000');
    expect(quinto.ok === false && quinto.motivo).toBe('bloqueado');
    const correcto = await m.negocio.iniciarSesion(id, '1234');
    expect(correcto.ok === false && correcto.motivo).toBe('bloqueado');
    m.reloj.avanzar(1);
    expect((await m.negocio.iniciarSesion(id, '1234')).ok).toBe(true);
  });
});
