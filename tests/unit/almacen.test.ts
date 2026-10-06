import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria, RutaInvalida, type Disco } from '../../src/core/almacen/almacen';

/** Disco en memoria que "se apaga" en la operación número `fallarEn` (simula batería agotada). */
class DiscoQueFalla extends DiscoMemoria {
  operaciones = 0;
  constructor(private readonly fallarEn: number) {
    super();
  }
  private contar() {
    this.operaciones += 1;
    if (this.operaciones === this.fallarEn) throw new Error('apagón');
  }
  override async escribir(ruta: string, contenido: string) {
    this.contar();
    await super.escribir(ruta, contenido);
  }
  override async renombrar(origen: string, destino: string) {
    this.contar();
    await super.renombrar(origen, destino);
  }
}

describe('Almacen', () => {
  it('guarda, lee, lista y borra', async () => {
    const almacen = crearAlmacen(new DiscoMemoria());
    await almacen.escribir('notas/a.md', 'hola');
    await almacen.escribir('notas/b.md', 'chao');
    expect(await almacen.leer('notas/a.md')).toBe('hola');
    expect(await almacen.listar('notas')).toEqual(['a.md', 'b.md']);
    await almacen.borrar('notas/a.md');
    expect(await almacen.leer('notas/a.md')).toBeNull();
    expect(await almacen.listar('notas')).toEqual(['b.md']);
  });

  it('una carpeta que no existe se lista vacía', async () => {
    expect(await crearAlmacen(new DiscoMemoria()).listar('notas')).toEqual([]);
  });

  it('escribe primero a un temporal y luego renombra', async () => {
    const disco = new DiscoMemoria();
    const pasos: string[] = [];
    const espia: Disco = {
      leer: (r) => disco.leer(r),
      listar: (c) => disco.listar(c),
      borrar: (r) => disco.borrar(r),
      escribir: async (r, c) => {
        pasos.push(`escribir ${r}`);
        await disco.escribir(r, c);
      },
      renombrar: async (o, d) => {
        pasos.push(`renombrar ${o} → ${d}`);
        await disco.renombrar(o, d);
      },
    };
    await crearAlmacen(espia).escribir('notas/a.md', 'x');
    expect(pasos).toEqual(['escribir notas/a.md.tmp', 'renombrar notas/a.md.tmp → notas/a.md']);
  });

  it('si se corta al escribir el temporal, la versión anterior queda intacta', async () => {
    const disco = new DiscoQueFalla(3); // 1-2: primer guardado; 3: temporal del segundo
    const almacen = crearAlmacen(disco);
    await almacen.escribir('notas/a.md', 'versión 1');
    await expect(almacen.escribir('notas/a.md', 'versión 2 a medias')).rejects.toThrow('apagón');
    expect(await almacen.leer('notas/a.md')).toBe('versión 1');
  });

  it('si queda un temporal viejo junto al archivo, se descarta al listar', async () => {
    const disco = new DiscoMemoria();
    await disco.escribir('notas/a.md', 'bueno');
    await disco.escribir('notas/a.md.tmp', 'a medi');
    const almacen = crearAlmacen(disco);
    expect(await almacen.listar('notas')).toEqual(['a.md']);
    expect(await disco.leer('notas/a.md.tmp')).toBeNull();
    expect(await almacen.leer('notas/a.md')).toBe('bueno');
  });

  it('si solo quedó el temporal (Android borra el destino antes de renombrar), se recupera', async () => {
    const disco = new DiscoMemoria();
    await disco.escribir('notas/a.md.tmp', 'versión 2 completa');
    const almacen = crearAlmacen(disco);
    expect(await almacen.leer('notas/a.md')).toBe('versión 2 completa');
    expect(await disco.leer('notas/a.md.tmp')).toBeNull();

    await disco.escribir('notas/b.md.tmp', 'otra');
    expect(await almacen.listar('notas')).toEqual(['a.md', 'b.md']);
    expect(await disco.leer('notas/b.md')).toBe('otra');
  });

  it('guardados simultáneos del mismo archivo no se pisan: gana el último', async () => {
    const almacen = crearAlmacen(new DiscoMemoria());
    await Promise.all(['1', '2', '3', '4'].map((v) => almacen.escribir('notas/a.md', v)));
    expect(await almacen.leer('notas/a.md')).toBe('4');
    expect(await almacen.listar('notas')).toEqual(['a.md']);
  });

  it('un guardado fallido no bloquea los siguientes', async () => {
    const almacen = crearAlmacen(new DiscoQueFalla(1));
    await expect(almacen.escribir('notas/a.md', 'x')).rejects.toThrow('apagón');
    await almacen.escribir('notas/a.md', 'y');
    expect(await almacen.leer('notas/a.md')).toBe('y');
  });

  it.each([
    '../fuera.md',
    'notas/../../etc/passwd',
    '/notas/a.md',
    'notas//a.md',
    'notas/./a.md',
    'notas\\a.md',
    'notas/.oculto',
    'notas/a.md.tmp',
    '',
    'notas/a b.md',
    'notas/%2e%2e',
  ])('rechaza la ruta peligrosa o reservada %j', async (ruta) => {
    const almacen = crearAlmacen(new DiscoMemoria());
    await expect(almacen.escribir(ruta, 'x')).rejects.toBeInstanceOf(RutaInvalida);
    await expect(almacen.leer(ruta)).rejects.toBeInstanceOf(RutaInvalida);
    await expect(almacen.borrar(ruta)).rejects.toBeInstanceOf(RutaInvalida);
  });
});
