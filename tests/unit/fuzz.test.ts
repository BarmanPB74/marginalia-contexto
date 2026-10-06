import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { cancionEnRuta, diaEnRuta, etiquetaEnRuta, idNotaEnRuta } from '../../src/app/rutas';
import { leerZip, ZipInvalido } from '../../src/core/exportar/zip';
import { renderMarkdown } from '../../src/core/markdown/render';
import { leerEnlace } from '../../src/core/musica/enlaces';
import { cancionDeNota, leerHrefCancion } from '../../src/core/musica/etiqueta';
import { leerEnlaceSpotify } from '../../src/core/musica/spotify';
import { escribirNota, leerNota, NotaInvalida } from '../../src/core/notas/nota';
import { parseNota } from '../../src/core/parser/parser';
import { estadoSeguro } from '../../src/features/musica/spotifyRemoto';

/**
 * Fuzzing casero (F5, docs/SEGURIDAD.md §5): entradas hostiles generadas al azar, con semilla
 * fija para que un fallo se pueda repetir. Cada función que recibe datos de fuera debe:
 * no colgarse, no lanzar errores inesperados y no dejar pasar nada ejecutable.
 */

/** PRNG con semilla (mulberry32): mismas entradas en cada ejecución. */
function azar(semilla: number) {
  let a = semilla >>> 0;
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (n: number) => Math.floor(siguiente() * n);
  const de = <T>(lista: readonly T[]): T => lista[entero(lista.length)] as T;
  return { siguiente, entero, de };
}

const PIEZAS = [
  '---\n', '---', 'id: 01JABCDEFGHJKMNPQRSTVWXYZ0\n', 'titulo: ', 'etiquetas:\n  - ', 'padre: ', 'cancion:\n  yt: ',
  '!!js/function "x"', '!!python/object', '&a [*a, *a]', '*a', '<<: *a', '{', '}', '[', ']', ':', '- ', '\n', '\r\n', '\t',
  '"', "'", '\\', '\0', '‮', '\ud800', '🎵', 'ñ', '#', '#etiqueta', '##', '@2026-02-30', '@2026-10-06 25:61', '@',
  '[[', ']]', '[♪ 1:39](yt:dQw4w9WgXcQ?t=99)', '[♪](yt:', '(spotify:track:4uLU6hMCjMI75M1A2tKUQC?t=1)', '```', '`',
  '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', '<iframe src=//x>', '<a href="javascript:alert(1)">x</a>',
  '[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](data:text/html,<script>alert(1)</script>)', '[x](vbscript:x)',
  '![x](javascript:alert(1))', '<style>*{}</style>', '<form action=//x>', '<base href=//x>', '<meta http-equiv=refresh>',
  '&#106;avascript:', '&lt;script&gt;', '> [!nota] ', '| a | b |\n|---|---|\n', '***', '_', '~~', 'https://music.youtube.com/watch?v=',
  'https://open.spotify.com/track/', 'a'.repeat(300), '#'.repeat(200), '@'.repeat(200), '['.repeat(200), '('.repeat(200),
];

function textoHostil(r: ReturnType<typeof azar>, max = 40): string {
  let s = '';
  const n = 1 + r.entero(max);
  for (let i = 0; i < n; i++) s += r.siguiente() < 0.8 ? r.de(PIEZAS) : String.fromCharCode(r.entero(0x2fff));
  return s;
}

const VUELTAS = 1500;

/** Ningún elemento ni atributo ejecutable en el HTML de lectura. */
function comprobarHtmlSeguro(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  for (const el of doc.body.querySelectorAll('*')) {
    expect(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'STYLE', 'FORM', 'BASE', 'META', 'SVG', 'MATH']).not.toContain(el.tagName.toUpperCase());
    for (const atributo of el.attributes) {
      expect(atributo.name.startsWith('on')).toBe(false);
      if (['href', 'src', 'xlink:href', 'action', 'formaction'].includes(atributo.name)) {
        const limpio = [...atributo.value].filter((c) => c.charCodeAt(0) > 0x20).join('').toLowerCase();
        expect(limpio).not.toMatch(/^(javascript|vbscript|data):/);
      }
    }
  }
}

describe('fuzzing (F5)', { timeout: 60_000 }, () => {
  it('leerNota/parseNota: solo NotaInvalida como error y lo leído se vuelve a leer igual', () => {
    const r = azar(20261006);
    let validas = 0;
    for (let i = 0; i < VUELTAS; i++) {
      // La mitad con un marco válido (id + cierre) para que el fuzzing llegue a leer YAML y cuerpo
      const yamlHostil = r.siguiente() < 0.5 ? `${r.de(['titulo', 'etiquetas', 'padre', 'cancion', 'x'])}: ${textoHostil(r, 4).replace(/---/g, '')}\n` : '';
      const texto =
        r.siguiente() < 0.6
          ? `---\nid: 01JABCDEFGHJKMNPQRSTVWXYZ0\n${yamlHostil}---\n${textoHostil(r)}`
          : textoHostil(r);
      try {
        const { meta } = parseNota(texto);
        validas++;
        // Ida y vuelta: escribir lo leído y leerlo de nuevo da lo mismo
        expect(leerNota(escribirNota(meta))).toEqual(meta);
        cancionDeNota(meta);
      } catch (e) {
        if (!(e instanceof NotaInvalida)) throw new Error(`Error inesperado con ${JSON.stringify(texto)}`, { cause: e });
      }
    }
    // Que el fuzzing ejercite también el camino válido, no solo el rechazo
    expect(validas).toBeGreaterThan(50);
  });

  it('renderMarkdown: nunca deja HTML ejecutable', () => {
    const r = azar(74);
    for (let i = 0; i < VUELTAS / 3; i++) comprobarHtmlSeguro(renderMarkdown(textoHostil(r)));
  });

  it('enlaces, rutas y etiquetas ♪: nunca lanzan y solo devuelven IDs válidos', () => {
    const r = azar(5);
    for (let i = 0; i < VUELTAS * 2; i++) {
      const t = textoHostil(r, 12);
      const yt = leerEnlace(t);
      if (yt?.video) expect(yt.video).toMatch(/^[A-Za-z0-9_-]{11}$/);
      const sp = leerEnlaceSpotify(t);
      if (sp) expect(sp.uri).toMatch(/^spotify:(track|episode|album|playlist):[A-Za-z0-9]{22}$/);
      const href = leerHrefCancion(t);
      if (href) expect(href.id).toMatch(/^([A-Za-z0-9_-]{11}|spotify:(track|episode):[A-Za-z0-9]{22})$/);
      const hash = `#/${r.de(['musica', 'notas', 'calendario'])}${r.de(['?', '/', '?yt=', '?sp=', '?etiqueta='])}${r.siguiente() < 0.5 ? t : `%${t}%E0%A4%A`}`;
      const c = cancionEnRuta(hash);
      if (c) expect(Number.isInteger(c.t) && c.t >= 0).toBe(true);
      idNotaEnRuta(hash);
      diaEnRuta(hash);
      etiquetaEnRuta(hash);
    }
  });

  it('estado de Spotify: cualquier forma de datos se limpia o se descarta', () => {
    const r = azar(13);
    const valores = [null, undefined, true, false, 0, -1, NaN, Infinity, 1e20, '', 'x', [], {}, { a: 1 }, 'spotify:track:4uLU6hMCjMI75M1A2tKUQC'];
    for (let i = 0; i < VUELTAS; i++) {
      const d = Object.fromEntries(
        ['pausado', 'posicionMs', 'uri', 'titulo', 'artista', 'duracionMs', '__proto__'].map((k) => [k, r.siguiente() < 0.3 ? textoHostil(r, 3) : r.de(valores)]),
      );
      const e = estadoSeguro(d);
      if (!e) continue;
      expect(typeof e.pausado).toBe('boolean');
      expect(Number.isFinite(e.posicionMs) && e.posicionMs >= 0).toBe(true);
      if (e.uri) expect(e.uri).toMatch(/^spotify:[a-z]+:[A-Za-z0-9]{22}$/);
    }
  });

  it('leerZip: bytes al azar y ZIP alterados solo dan ZipInvalido o notas válidas', () => {
    const r = azar(99);
    const nota = (id: string, cuerpo: string) => strToU8(`---\nid: ${id}\ntitulo: T\n---\n${cuerpo}`);
    const base = zipSync({
      'notas/01JABCDEFGHJKMNPQRSTVWXYZ0.md': nota('01JABCDEFGHJKMNPQRSTVWXYZ0', 'hola'),
      'notas/01JABCDEFGHJKMNPQRSTVWXYZ1.md': nota('01JABCDEFGHJKMNPQRSTVWXYZ1', '<script>x</script>'),
      '../../fuera.md': nota('01JABCDEFGHJKMNPQRSTVWXYZ2', 'zip-slip'),
      'LEEME.txt': strToU8('x'),
    });
    for (let i = 0; i < 400; i++) {
      let bytes: Uint8Array;
      if (r.siguiente() < 0.3) {
        bytes = new Uint8Array(r.entero(2000));
        for (let j = 0; j < bytes.length; j++) bytes[j] = r.entero(256);
      } else {
        bytes = base.slice();
        for (let j = 0, n = 1 + r.entero(8); j < n; j++) bytes[r.entero(bytes.length)] = r.entero(256);
      }
      try {
        const { notas, rechazados } = leerZip(bytes);
        for (const n of notas) expect(n.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
        for (const x of rechazados) expect(x.archivo).not.toBe('');
      } catch (e) {
        if (!(e instanceof ZipInvalido)) throw new Error(`Error inesperado en la vuelta ${i}`, { cause: e });
      }
    }
    // El ZIP sin alterar: la entrada con "../" se rechaza siempre
    expect(leerZip(base).rechazados.map((x) => x.archivo)).toContain('../../fuera.md');
  });

  it('entradas patológicas largas se procesan rápido (sin ReDoS)', () => {
    const largos = ['#a'.repeat(50_000), '@2026-10-06'.repeat(20_000), '[['.repeat(100_000), '[♪ 1:39](yt:'.repeat(30_000), ' '.repeat(500_000) + '#x'];
    for (const cuerpo of largos) {
      const inicio = performance.now();
      parseNota(`---\nid: 01JABCDEFGHJKMNPQRSTVWXYZ0\n---\n${cuerpo}`);
      renderMarkdown(cuerpo.slice(0, 200_000));
      leerEnlace(cuerpo);
      leerEnlaceSpotify(cuerpo);
      expect(performance.now() - inicio).toBeLessThan(3000);
    }
  });

  it('YAML hostil: bomba de alias y etiquetas de tipo no se expanden ni ejecutan', () => {
    const niveles = ['a: &a ["x","x","x","x","x","x","x","x","x"]'];
    for (let i = 1; i < 10; i++) niveles.push(`${String.fromCharCode(97 + i)}: &${String.fromCharCode(97 + i)} [${Array(9).fill(`*${String.fromCharCode(96 + i)}`).join(',')}]`);
    const bomba = `---\nid: 01JABCDEFGHJKMNPQRSTVWXYZ0\n${niveles.join('\n')}\n---\n`;
    const inicio = performance.now();
    expect(() => leerNota(bomba)).toThrow(NotaInvalida);
    expect(performance.now() - inicio).toBeLessThan(1000);
    for (const tipo of ['!!js/function "function(){}"', '!!js/regexp /x/', '!!python/object:os.system x', '!!binary aGVsbG8=']) {
      try {
        const n = leerNota(`---\nid: 01JABCDEFGHJKMNPQRSTVWXYZ0\nx: ${tipo}\n---\n`);
        expect(typeof n.extra['x']).not.toBe('function');
      } catch (e) {
        expect(e).toBeInstanceOf(NotaInvalida);
      }
    }
  });
});
