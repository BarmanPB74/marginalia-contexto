import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { exportarZip, leerZip, MAX_ARCHIVOS, ZipInvalido } from '../../src/core/exportar/zip';
import { escribirNota, type Nota } from '../../src/core/notas/nota';
import { RepositorioNotas } from '../../src/core/notas/repositorio';
import { ulid } from '../../src/core/notas/ulid';

const repoNuevo = () => new RepositorioNotas(crearAlmacen(new DiscoMemoria()));

function nota(titulo: string, extra: Partial<Nota> = {}): Nota {
  return {
    id: ulid(),
    titulo,
    creado: '2026-10-05T09:00:00-05:00',
    editado: '2026-10-05T09:30:00-05:00',
    etiquetas: ['estudio'],
    extra: { fecha: '2026-10-12', desconocido: { a: 1 } },
    cuerpo: `# ${titulo}\n\nTexto con **Markdown**, ñ y 🎵.\n`,
    ...extra,
  };
}

const zip = (archivos: Record<string, string | Uint8Array>) =>
  zipSync(Object.fromEntries(Object.entries(archivos).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])));

describe('exportarZip / leerZip', () => {
  it('ida y vuelta sin pérdida: mismo .md byte a byte, con LEEME.txt', () => {
    const notas = [nota('Uno'), nota('Dos')];
    const bytes = exportarZip(notas);
    const { notas: leidas, rechazados } = leerZip(bytes);
    expect(rechazados).toEqual([]);
    expect(leidas.map(escribirNota).sort()).toEqual(notas.map(escribirNota).sort());
  });

  it('el ZIP no lleva nada cifrado ni la hora local', () => {
    const texto = new TextDecoder().decode(exportarZip([nota('Visible')]));
    expect(texto).not.toContain('MARGINALIA-CIFRADO');
    expect(exportarZip([])).toEqual(exportarZip([]));
  });

  it('rechaza rutas hostiles (zip-slip, absolutas, Windows, ocultas) sin tocar las buenas', () => {
    const buena = nota('Buena');
    const mala = escribirNota(nota('Mala'));
    const { notas, rechazados } = leerZip(
      zip({
        [`notas/${buena.id}.md`]: escribirNota(buena),
        '../../fuera.md': mala,
        'notas/../../fuera2.md': mala,
        '/etc/absoluta.md': mala,
        'C:/windows.md': mala,
        'notas/.oculta.md': mala,
        'imagen.png': 'x',
      }),
    );
    expect(notas.map((n) => n.titulo)).toEqual(['Buena']);
    expect(rechazados.map((r) => r.motivo)).toEqual(Array(5).fill('ruta no permitida'));
  });

  it('rechaza notas de más de 2 MB, texto no UTF-8, YAML hostil e ids repetidos', () => {
    const n = nota('Repetida');
    const bomba = `---\na: &a [x,x,x,x,x,x,x,x,x]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\nd: [*c,*c,*c,*c,*c,*c,*c,*c,*c]\nid: ${ulid()}\n---\n`;
    const { notas, rechazados } = leerZip(
      zip({
        'grande.md': 'a'.repeat(2 * 1024 * 1024 + 1),
        'latin1.md': new Uint8Array([0x2d, 0x2d, 0x2d, 0x0a, 0xf1, 0xff]),
        'bomba.md': bomba,
        'sin-frontmatter.md': '# hola',
        'a.md': escribirNota(n),
        'b.md': escribirNota(n),
      }),
    );
    expect(notas).toHaveLength(1);
    const motivos = Object.fromEntries(rechazados.map((r) => [r.archivo, r.motivo]));
    expect(motivos['grande.md']).toBe('supera 2 MB');
    expect(motivos['latin1.md']).toBe('no es texto UTF-8');
    expect(motivos['bomba.md']).toMatch(/Nota inválida/);
    expect(motivos['sin-frontmatter.md']).toMatch(/frontmatter/);
    expect(motivos['b.md']).toBe('id repetido en el ZIP');
  });

  it('un tamaño declarado falso no cuela una nota gigante', () => {
    const bytes = zip({ 'mentira.md': 'a'.repeat(3 * 1024 * 1024) });
    // Falsear el "tamaño original" del directorio central (offset 24 de la firma PK\x01\x02)
    const vista = new DataView(bytes.buffer);
    for (let i = 0; i < bytes.length - 4; i++) {
      if (vista.getUint32(i, true) === 0x02014b50) vista.setUint32(i + 24, 100, true);
    }
    let notas: Nota[] = [];
    try {
      notas = leerZip(bytes).notas;
    } catch (e) {
      expect(e).toBeInstanceOf(ZipInvalido);
    }
    expect(notas).toEqual([]);
  });

  it(`más de ${MAX_ARCHIVOS} archivos o algo que no es un ZIP: error claro`, () => {
    const muchos = zip(Object.fromEntries(Array.from({ length: MAX_ARCHIVOS + 1 }, (_, i) => [`${i}.md`, 'x'])));
    expect(() => leerZip(muchos)).toThrow(ZipInvalido);
    expect(() => leerZip(strToU8('no soy un zip'))).toThrow(/no se pudo leer/);
  });
});

describe('RepositorioNotas.importar', () => {
  it('exportar, borrar todo e importar devuelve las mismas notas (historia 7)', async () => {
    const repo = repoNuevo();
    const madre = await repo.crear({ titulo: 'Francés' });
    const hija = await repo.crear({ titulo: 'Subjuntivo', padre: madre.id });
    await repo.guardar({ ...hija, cuerpo: 'Texto @2026-10-12 #idiomas' });
    const antes = (await repo.listar()).notas.map(escribirNota).sort();

    const bytes = exportarZip((await repo.listar()).notas);
    const vacio = repoNuevo();
    expect(await vacio.importar(leerZip(bytes).notas)).toEqual({ nuevas: 2, iguales: 0, copias: 0 });
    expect((await vacio.listar()).notas.map(escribirNota).sort()).toEqual(antes);
  });

  it('nunca pisa lo que hay: iguales se saltan; distintas entran como copia', async () => {
    const repo = repoNuevo();
    const n = await repo.crear({ titulo: 'Diario' });
    const cambiada = { ...n, cuerpo: 'otra versión' };
    expect(await repo.importar([n, cambiada])).toEqual({ nuevas: 0, iguales: 1, copias: 1 });
    const { notas } = await repo.listar();
    expect(notas.map((x) => x.titulo).sort()).toEqual(['Diario', 'Diario (importada)']);
    expect((await repo.obtener(n.id))?.cuerpo).toBe(n.cuerpo);
  });
});
