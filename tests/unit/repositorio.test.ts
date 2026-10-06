import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { escribirNota, leerNota, NotaInvalida, type Nota } from '../../src/core/notas/nota';
import { aplicarPlantilla, PLANTILLAS } from '../../src/core/notas/plantillas';
import { arbol, RepositorioNotas } from '../../src/core/notas/repositorio';

const AHORA = new Date('2026-10-05T08:30:00');

function nuevo() {
  const disco = new DiscoMemoria();
  const almacen = crearAlmacen(disco);
  return { disco, almacen, repo: new RepositorioNotas(almacen, () => AHORA) };
}

describe('plantillas', () => {
  it('sustituye las variables conocidas y deja las demás', () => {
    expect(aplicarPlantilla('{{titulo}} · {{ fecha }} {{hora}} {{otra}}', { titulo: 'X', ahora: AHORA })).toBe(
      'X · 2026-10-05 08:30 {{otra}}',
    );
  });

  it('no vuelve a sustituir lo que trae el título (sin inyección)', () => {
    expect(aplicarPlantilla('# {{titulo}}', { titulo: '{{fecha}}', ahora: AHORA })).toBe('# {{fecha}}');
  });

  it('trae en blanco, rápida, bitácora y reunión', () => {
    expect(PLANTILLAS.map((p) => p.id)).toEqual(['en-blanco', 'rapida', 'bitacora', 'reunion']);
  });
});

describe('RepositorioNotas', () => {
  it('crea una nota en blanco, la guarda en notas/<id>.md y la vuelve a leer', async () => {
    const { repo, almacen } = nuevo();
    const nota = await repo.crear({ titulo: 'Mi página' });
    expect(nota.titulo).toBe('Mi página');
    expect(nota.creado).toBe(nota.editado);
    expect(await almacen.listar('notas')).toEqual([`${nota.id}.md`]);
    expect(await repo.obtener(nota.id)).toEqual(nota);
  });

  it('crea desde la plantilla de reunión con fecha y etiqueta', async () => {
    const { repo } = nuevo();
    const nota = await repo.crear({ plantilla: 'reunion' });
    expect(nota.titulo).toBe('Reunión 2026-10-05');
    expect(nota.etiquetas).toEqual(['reunión']);
    expect(nota.cuerpo).toContain('## Acuerdos');
    expect(nota.cuerpo).toContain('- [ ] ');
  });

  it('el título propio manda sobre el de la plantilla', async () => {
    const { repo } = nuevo();
    const nota = await repo.crear({ plantilla: 'bitacora', titulo: 'Bitácora del viaje' });
    expect(nota.titulo).toBe('Bitácora del viaje');
    expect(nota.cuerpo).not.toContain('Bitácora'); // el título vive solo en su campo
    expect(nota.cuerpo).toContain('## 08:30');
  });

  it('bitácora de un día del calendario: título, @fecha y fecha: de ese día', async () => {
    const repo = new RepositorioNotas(crearAlmacen(new DiscoMemoria()), () => new Date(2026, 9, 5, 9, 30));
    const nota = await repo.crear({ plantilla: 'bitacora', dia: '2026-10-12' });
    expect(nota.titulo).toBe('Bitácora 2026-10-12');
    expect(nota.cuerpo).toBe('@2026-10-12\n\n## 09:30\n\n');
    expect(nota.extra['fecha']).toBe('2026-10-12');
    expect(nota.creado.startsWith('2026-10-05T09:30')).toBe(true);
    await expect(repo.crear({ plantilla: 'bitacora', dia: '2026-02-30' })).rejects.toThrow('día');
  });

  it('rechaza una plantilla que no existe o un padre que no existe', async () => {
    const { repo } = nuevo();
    await expect(repo.crear({ plantilla: 'nope' })).rejects.toThrow('plantilla');
    await expect(repo.crear({ padre: '01J9ZK0000000000000000ABCD' })).rejects.toThrow('padre');
  });

  it('guardar actualiza "editado" y conserva lo demás', async () => {
    let reloj = AHORA;
    const repoConReloj = new RepositorioNotas(crearAlmacen(new DiscoMemoria()), () => reloj);
    const nota = await repoConReloj.crear({ titulo: 'a' });
    reloj = new Date('2026-10-05T09:00:00');
    const guardada = await repoConReloj.guardar({ ...nota, cuerpo: 'nuevo' });
    expect(guardada.editado).not.toBe(nota.editado);
    expect(guardada.creado).toBe(nota.creado);
    expect((await repoConReloj.obtener(nota.id))?.cuerpo).toBe('nuevo');
  });

  it('no guarda una nota que ya no se podría leer (más de 2 MB)', async () => {
    const { repo } = nuevo();
    const nota = await repo.crear({ titulo: 'grande' });
    await expect(repo.guardar({ ...nota, cuerpo: 'a'.repeat(2 * 1024 * 1024) })).rejects.toBeInstanceOf(NotaInvalida);
    expect((await repo.obtener(nota.id))?.cuerpo).toBe('');
  });

  it('obtener con un id malicioso no toca el disco y da null', async () => {
    const { repo } = nuevo();
    expect(await repo.obtener('../../ajustes')).toBeNull();
  });

  it('listar sobrevive a archivos dañados y los informa', async () => {
    const { repo, disco } = nuevo();
    const buena = await repo.crear({ titulo: 'buena' });
    await disco.escribir('notas/01J9ZK3Q8V2M4N6P7R8S9T0WXY.md', 'basura sin frontmatter');
    // copia de un archivo con otro nombre: mismo id dentro → no se acepta como otra nota
    await disco.escribir('notas/01J9ZK0000000000000000ABCD.md', escribirNota(buena));
    await disco.escribir('notas/LEEME.txt', 'hola');
    const { notas, danadas } = await repo.listar();
    expect(notas.map((n) => n.id)).toEqual([buena.id]);
    expect(danadas.sort()).toEqual(['01J9ZK0000000000000000ABCD.md', '01J9ZK3Q8V2M4N6P7R8S9T0WXY.md']);
  });

  it('recargar (repositorio nuevo sobre el mismo disco) conserva todo', async () => {
    const { repo, disco } = nuevo();
    const madre = await repo.crear({ titulo: 'Madre' });
    const hija = await repo.crear({ titulo: 'Hija', padre: madre.id });
    const otro = new RepositorioNotas(crearAlmacen(disco), () => AHORA);
    const { notas } = await otro.listar();
    expect(notas).toEqual(expect.arrayContaining([madre, hija]));
    expect(notas).toHaveLength(2);
  });

  it('borrar una madre sube sus hijas un nivel (no se pierden)', async () => {
    const { repo } = nuevo();
    const abuela = await repo.crear({ titulo: 'Abuela' });
    const madre = await repo.crear({ titulo: 'Madre', padre: abuela.id });
    const hija = await repo.crear({ titulo: 'Hija', padre: madre.id });
    await repo.borrar(madre.id);
    expect(await repo.obtener(madre.id)).toBeNull();
    expect((await repo.obtener(hija.id))?.padre).toBe(abuela.id);
  });

  it('mover rechaza ciclos y padres inexistentes; mover a la raíz quita el padre', async () => {
    const { repo } = nuevo();
    const a = await repo.crear({ titulo: 'A' });
    const b = await repo.crear({ titulo: 'B', padre: a.id });
    const c = await repo.crear({ titulo: 'C', padre: b.id });
    await expect(repo.mover(a.id, c.id)).rejects.toThrow('ciclo');
    await expect(repo.mover(a.id, a.id)).rejects.toThrow('ciclo');
    await expect(repo.mover(a.id, '01J9ZK0000000000000000ABCD')).rejects.toThrow('padre');
    const movida = await repo.mover(c.id, undefined);
    expect(movida.padre).toBeUndefined();
    expect((await repo.obtener(c.id))?.padre).toBeUndefined();
  });
});

describe('arbol', () => {
  const ids = ['01J9ZK0000000000000000000A', '01J9ZK0000000000000000000B', '01J9ZK0000000000000000000C', '01J9ZK0000000000000000000D'] as const;
  function nota(id: string, titulo: string, padre?: string): Nota {
    return leerNota(`---\nid: ${id}\ntitulo: ${titulo}\n${padre ? `padre: ${padre}\n` : ''}---\n`);
  }

  it('anida por padre y ordena por título', () => {
    const [a, b, c, d] = ids;
    const raices = arbol([nota(a, 'Zeta'), nota(b, 'beta', a), nota(c, 'Alfa', a), nota(d, 'Ábaco')]);
    expect(raices.map((n) => n.nota.titulo)).toEqual(['Ábaco', 'Zeta']);
    expect(raices[1]?.hijas.map((n) => n.nota.titulo)).toEqual(['Alfa', 'beta']);
  });

  it('un padre que no existe deja la nota en la raíz', () => {
    const [a, b] = ids;
    expect(arbol([nota(a, 'A', b)]).map((n) => n.nota.id)).toEqual([a]);
  });

  it('un ciclo en archivos hostiles no cuelga y cada nota aparece una vez', () => {
    const [a, b, c, d] = ids;
    const raices = arbol([nota(a, 'A', c), nota(b, 'B', a), nota(c, 'C', b), nota(d, 'D', c)]);
    const vistas: string[] = [];
    const recorrer = (nodos: typeof raices) =>
      nodos.forEach((n) => {
        vistas.push(n.nota.id);
        recorrer(n.hijas);
      });
    recorrer(raices);
    expect(vistas.sort()).toEqual([...ids]);
    expect(raices.length).toBeGreaterThanOrEqual(1);
  });
});
