import { describe, expect, it } from 'vitest';
import { esUlid, ulid } from '../../src/core/notas/ulid';
import { escribirNota, isoConOffset, leerNota, NotaInvalida, type Nota } from '../../src/core/notas/nota';

describe('ulid', () => {
  it('tiene 26 caracteres Crockford y empieza por la hora', () => {
    const id = ulid(1469918176385); // ejemplo de la especificación ULID
    expect(esUlid(id)).toBe(true);
    expect(id.slice(0, 10)).toBe('01ARYZ6S41');
  });

  it('ordena por fecha de creación', () => {
    expect(ulid(1000) < ulid(2000)).toBe(true);
  });

  it('no repite', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => ulid(0)));
    expect(ids.size).toBe(2000);
  });

  it.each(['', '01J9ZK3Q8V2M4N6P7R8S9T0WX', '01J9ZK3Q8V2M4N6P7R8S9T0WXU', '01j9zk3q8v2m4n6p7r8s9t0wxy', '../01J9ZK3Q8V2M4N6P7R8S9T'])(
    'rechaza %j',
    (texto) => expect(esUlid(texto)).toBe(false),
  );
});

describe('isoConOffset', () => {
  it('escribe la hora local con su desfase', () => {
    expect(isoConOffset(new Date('2026-10-03T20:45:00-05:00'))).toMatch(
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/,
    );
    expect(new Date(isoConOffset(new Date('2026-10-03T20:45:00Z'))).toISOString()).toBe('2026-10-03T20:45:00.000Z');
  });
});

const ID = '01J9ZK3Q8V2M4N6P7R8S9T0WXY';
const TEXTO = `---
id: ${ID}
titulo: Subjuntivo en francés
creado: 2026-10-03T20:45:00-05:00
editado: 2026-10-03T21:10:00-05:00
etiquetas: [francés, estudio]
fecha: 2026-10-10
cancion:
  yt: dQw4w9WgXcQ
  t: 139
padre: 01J9ZK0000000000000000ABCD
---

# Subjuntivo en francés

Texto con **Markdown**.
`;

describe('leerNota / escribirNota', () => {
  it('lee los campos conocidos y deja el cuerpo tal cual', () => {
    const nota = leerNota(TEXTO);
    expect(nota).toMatchObject({
      id: ID,
      titulo: 'Subjuntivo en francés',
      creado: '2026-10-03T20:45:00-05:00',
      editado: '2026-10-03T21:10:00-05:00',
      etiquetas: ['francés', 'estudio'],
      padre: '01J9ZK0000000000000000ABCD',
      cuerpo: '\n# Subjuntivo en francés\n\nTexto con **Markdown**.\n',
    });
  });

  it('preserva los campos que no conoce (de F3/F4 o de otros editores)', () => {
    const otra = leerNota(escribirNota(leerNota(TEXTO)));
    expect(otra.extra).toEqual({ fecha: '2026-10-10', cancion: { yt: 'dQw4w9WgXcQ', t: 139 } });
    expect(otra).toEqual(leerNota(TEXTO));
  });

  it('ida y vuelta sin pérdida, también con Unicode y cuerpo vacío', () => {
    const nota: Nota = {
      id: ID,
      titulo: 'Ñandú: "comillas", #almohadilla y — rayas 🎵',
      creado: '2026-10-05T08:00:00-05:00',
      editado: '2026-10-05T08:00:00-05:00',
      etiquetas: ['tilde-á'],
      extra: {},
      cuerpo: '',
    };
    expect(leerNota(escribirNota(nota))).toEqual(nota);
  });

  it('acepta finales de línea de Windows y BOM', () => {
    const windows = '\uFEFF' + TEXTO.replaceAll('\n', '\r\n');
    expect(leerNota(windows).titulo).toBe('Subjuntivo en francés');
  });

  it('sin título usa el primer encabezado, y si no hay, "Sin título"', () => {
    const base = `---\nid: ${ID}\ncreado: 2026-10-05T08:00:00-05:00\n---\n`;
    expect(leerNota(base + '\n# Mi página\n').titulo).toBe('Mi página');
    expect(leerNota(base + 'solo texto').titulo).toBe('Sin título');
  });

  it('tolera etiquetas sueltas o con basura', () => {
    const base = `---\nid: ${ID}\ncreado: x\n`;
    expect(leerNota(base + 'etiquetas: estudio\n---\n').etiquetas).toEqual(['estudio']);
    expect(leerNota(base + 'etiquetas: [a, 3, {x: 1}, null]\n---\n').etiquetas).toEqual(['a', '3']);
  });

  it('ignora un padre inválido en vez de seguirlo', () => {
    expect(leerNota(`---\nid: ${ID}\npadre: ../../secreto\n---\n`).padre).toBeUndefined();
  });

  describe('archivos hostiles', () => {
    it.each([
      ['sin frontmatter', '# Hola'],
      ['frontmatter sin cerrar', `---\nid: ${ID}\n`],
      ['sin id', '---\ntitulo: x\n---\n'],
      ['id que no es ULID', '---\nid: ../../etc/passwd\n---\n'],
      ['id numérico', '---\nid: 12345678901234567890123456\n---\n'],
      ['YAML roto', `---\nid: ${ID}\ntitulo: [sin cerrar\n---\n`],
      ['YAML que es una lista', '---\n- a\n- b\n---\n'],
      ['claves repetidas', `---\nid: ${ID}\nid: ${ID}\n---\n`],
    ])('rechaza %s', (_caso, texto) => {
      expect(() => leerNota(texto)).toThrow(NotaInvalida);
    });

    it('rechaza la "bomba de alias" (billion laughs) sin colgarse', () => {
      const capas = ['a: &a [x, x, x, x, x, x, x, x, x, x]'];
      for (let i = 1; i < 12; i++) {
        const prev = String.fromCharCode(96 + i);
        const sig = String.fromCharCode(97 + i);
        capas.push(`${sig}: &${sig} [${Array(10).fill(`*${prev}`).join(', ')}]`);
      }
      const texto = `---\nid: ${ID}\n${capas.join('\n')}\n---\n`;
      const inicio = performance.now();
      expect(() => leerNota(texto)).toThrow(NotaInvalida);
      expect(performance.now() - inicio).toBeLessThan(1000);
    });

    it('no ejecuta etiquetas YAML de código ni contamina prototipos', () => {
      const texto = `---\nid: ${ID}\n__proto__: {contaminado: si}\nconstructor: x\nfn: !!js/function "function(){}"\n---\n`;
      const nota = leerNota(texto);
      expect(({} as Record<string, unknown>)['contaminado']).toBeUndefined();
      expect(typeof nota.extra['fn']).not.toBe('function');
      // y se puede volver a guardar sin perder ni ejecutar nada
      expect(() => leerNota(escribirNota(nota))).not.toThrow();
      expect(({} as Record<string, unknown>)['contaminado']).toBeUndefined();
    });

    it('rechaza notas de más de 2 MB y acepta las de justo 2 MB', () => {
      const cabeza = `---\nid: ${ID}\n---\n`;
      const limite = 2 * 1024 * 1024;
      expect(() => leerNota(cabeza + 'a'.repeat(limite - cabeza.length))).not.toThrow();
      expect(() => leerNota(cabeza + 'a'.repeat(limite - cabeza.length + 1))).toThrow(NotaInvalida);
      // cuenta bytes UTF-8, no caracteres: "ñ" ocupa 2
      expect(() => leerNota(cabeza + 'ñ'.repeat(limite / 2))).toThrow(NotaInvalida);
    });
  });
});
