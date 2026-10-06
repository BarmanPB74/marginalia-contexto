import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import {
  CABECERA,
  cifrarPendientes,
  cifrarTexto,
  descifrarTexto,
  discoCifrado,
  NoSePuedeDescifrar,
} from '../../src/core/almacen/cifrado';
import { RepositorioNotas } from '../../src/core/notas/repositorio';

const clave = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

describe('cifrarTexto / descifrarTexto', () => {
  it('ida y vuelta con tildes, emojis y textos grandes; cada vez un IV distinto', async () => {
    const k = await clave();
    const texto = `Ñandú 🎵 ${'x'.repeat(300_000)}`;
    const a = await cifrarTexto(k, texto, 'notas/a.md');
    const b = await cifrarTexto(k, texto, 'notas/a.md');
    expect(a.startsWith(CABECERA)).toBe(true);
    expect(a).not.toContain('Ñandú');
    expect(a).not.toBe(b);
    expect(await descifrarTexto(k, a, 'notas/a.md')).toBe(texto);
  });

  it('un archivo alterado, de otra nota o con otra clave no se descifra', async () => {
    const k = await clave();
    const c = await cifrarTexto(k, 'secreto', 'notas/a.md');
    const alterado = c.slice(0, -6) + (c.endsWith('AAAA') ? 'BBBB' : 'AAAA') + c.slice(-2);
    await expect(descifrarTexto(k, alterado, 'notas/a.md')).rejects.toBeInstanceOf(NoSePuedeDescifrar);
    await expect(descifrarTexto(k, c, 'notas/b.md')).rejects.toBeInstanceOf(NoSePuedeDescifrar);
    await expect(descifrarTexto(await clave(), c, 'notas/a.md')).rejects.toBeInstanceOf(NoSePuedeDescifrar);
  });
});

describe('discoCifrado bajo el repositorio', () => {
  it('al crear una nota el archivo ya está cifrado; el repositorio la lee en claro', async () => {
    const crudo = new DiscoMemoria();
    const k = await clave();
    const repo = new RepositorioNotas(crearAlmacen(discoCifrado(crudo, async () => k)));
    const nota = await repo.crear({ titulo: 'Diario', plantilla: 'bitacora' });
    const enDisco = (await crudo.leer(`notas/${nota.id}.md`)) ?? '';
    expect(enDisco.startsWith(CABECERA)).toBe(true);
    expect(enDisco).not.toContain('Diario');
    expect((await repo.obtener(nota.id))?.titulo).toBe('Diario');
    expect((await repo.listar()).notas).toHaveLength(1);
  });

  it('una nota en claro (de antes) se lee y cifrarPendientes la cifra sin cambiarla', async () => {
    const crudo = new DiscoMemoria();
    const k = await clave();
    const enClaro = new RepositorioNotas(crearAlmacen(crudo));
    const vieja = await enClaro.crear({ titulo: 'Vieja' });
    const almacen = crearAlmacen(discoCifrado(crudo, async () => k));
    const repo = new RepositorioNotas(almacen);
    expect((await repo.obtener(vieja.id))?.titulo).toBe('Vieja');

    expect(await cifrarPendientes(crudo, (r, t) => almacen.escribir(r, t), 'notas')).toBe(1);
    expect((await crudo.leer(`notas/${vieja.id}.md`))?.startsWith(CABECERA)).toBe(true);
    expect(await repo.obtener(vieja.id)).toEqual(vieja);
    expect(await cifrarPendientes(crudo, (r, t) => almacen.escribir(r, t), 'notas')).toBe(0);
  });

  it('un archivo que no se puede descifrar sale como dañado, sin tocar los demás', async () => {
    const crudo = new DiscoMemoria();
    const repo = new RepositorioNotas(crearAlmacen(discoCifrado(crudo, clave)));
    // cada llamada a clave() crea una distinta: lo escrito no se puede volver a leer
    await repo.crear({ titulo: 'Perdida' });
    const { notas, danadas } = await repo.listar();
    expect(notas).toHaveLength(0);
    expect(danadas).toHaveLength(1);
  });
});
