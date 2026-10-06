import { describe, expect, it } from 'vitest';
import { escribirNota, type Nota } from '../../src/core/notas/nota';
import { analizarNota, etiquetasDeNota, etiquetasDeTexto, parseNota } from '../../src/core/parser/parser';

const nota = (cuerpo: string, extra: Partial<Nota> = {}): Nota => ({
  id: '01J9ZK3Q8V2M4N6P7R8S9T0WXY',
  titulo: 't',
  creado: '',
  editado: '',
  etiquetas: [],
  extra: {},
  cuerpo,
  ...extra,
});

describe('etiquetasDeTexto', () => {
  it('encuentra #etiquetas con tildes, ñ, guiones y subetiquetas', () => {
    expect(etiquetasDeTexto('Hoy #estudio de #francés y #año-nuevo, también #proyectos/marginalia.')).toEqual([
      'estudio',
      'francés',
      'año-nuevo',
      'proyectos/marginalia',
    ]);
  });

  it('los encabezados, los números solos, los anclas de URL y lo pegado a palabras no son etiquetas', () => {
    const texto = '# Título\n## Otro\nVer #1 y #2026, https://x.org/pagina#seccion, correo#raro, C#';
    expect(etiquetasDeTexto(texto)).toEqual([]);
  });

  it('nada dentro de código; sin repetir sin importar mayúsculas', () => {
    expect(etiquetasDeTexto('`#codigo`\n```\n#bloque\n```\n#Idiomas y #idiomas (#viaje)')).toEqual(['Idiomas', 'viaje']);
  });

  it('quita la puntuación final de enlace y limita la longitud', () => {
    expect(etiquetasDeTexto(`#fin- #${'a'.repeat(65)}`)).toEqual(['fin']);
  });

  it('1 MB de texto patológico se analiza rápido (sin ReDoS)', () => {
    const texto = `${'#'.repeat(200_000)} ${'#a'.repeat(200_000)} ${'`'.repeat(100_000)}`;
    const inicio = performance.now();
    etiquetasDeTexto(texto);
    expect(performance.now() - inicio).toBeLessThan(1500);
  });
});

describe('analizarNota / parseNota', () => {
  it('une etiquetas del frontmatter y del texto, fechas, canciones y enlaces', () => {
    const n = nota(
      'Estudio #idiomas @2026-10-12 18:30\nSonaba [♪ 1:39](yt:dQw4w9WgXcQ?t=139) y [♪](yt:corto) en [[Pasado compuesto]] y [[Otra|alias]]\n```\n[[no]] #no @2026-10-13\n```',
      { etiquetas: ['Francés', 'idiomas'], extra: { fecha: '2026-10-10' } },
    );
    expect(analizarNota(n)).toEqual({
      fechas: ['2026-10-10', '2026-10-12'],
      etiquetas: ['Francés', 'idiomas'],
      canciones: [{ yt: 'dQw4w9WgXcQ', t: 139 }],
      enlaces: ['Pasado compuesto', 'Otra'],
    });
  });

  it('casos límite: vacío, solo frontmatter, Unicode', () => {
    expect(analizarNota(nota(''))).toEqual({ fechas: [], etiquetas: [], canciones: [], enlaces: [] });
    const r = parseNota(escribirNota(nota('', { etiquetas: ['日本語'] })));
    expect(r.etiquetas).toEqual(['日本語']);
    expect(r.meta.id).toBe('01J9ZK3Q8V2M4N6P7R8S9T0WXY');
  });

  it('etiquetasDeNota acepta "#" en el frontmatter', () => {
    expect(etiquetasDeNota(nota('', { etiquetas: ['#estudio', ' ', 'Estudio'] }))).toEqual(['estudio']);
  });
});
