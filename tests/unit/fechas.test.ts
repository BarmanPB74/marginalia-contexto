import { describe, expect, it } from 'vitest';
import {
  cuadriculaMes,
  esDiaValido,
  fechasDeNota,
  fechasDeTexto,
  notasPorDia,
} from '../../src/core/notas/fechas';
import type { Nota } from '../../src/core/notas/nota';

const nota = (id: string, titulo: string, cuerpo: string, extra: Record<string, unknown> = {}): Nota => ({
  id,
  titulo,
  creado: '',
  editado: '',
  etiquetas: [],
  extra,
  cuerpo,
});

describe('esDiaValido', () => {
  it('acepta días reales y rechaza imposibles', () => {
    expect(esDiaValido('2026-10-07')).toBe(true);
    expect(esDiaValido('2028-02-29')).toBe(true);
    expect(esDiaValido('2026-02-29')).toBe(false);
    expect(esDiaValido('2026-02-30')).toBe(false);
    expect(esDiaValido('2026-13-01')).toBe(false);
    expect(esDiaValido('2026-1-01')).toBe(false);
  });
});

describe('fechasDeTexto', () => {
  it('encuentra @fechas (con o sin hora), sin repetir y en orden', () => {
    expect(fechasDeTexto('Entrega @2026-10-12 18:30 y repaso @2026-10-10. Otra vez @2026-10-12')).toEqual([
      '2026-10-10',
      '2026-10-12',
    ]);
  });

  it('ignora fechas imposibles, pegadas a palabras o dentro de código', () => {
    const texto = [
      'mal @2026-02-30',
      'correo@2026-10-01',
      'en línea `@2026-10-02`',
      '```',
      '@2026-10-03',
      '```',
      '(@2026-10-04)',
    ].join('\n');
    expect(fechasDeTexto(texto)).toEqual(['2026-10-04']);
  });
});

describe('fechasDeNota', () => {
  it('une el frontmatter (texto o lista) con el cuerpo', () => {
    expect(fechasDeNota(nota('a', 'A', '@2026-10-09', { fecha: '2026-10-10' }))).toEqual(['2026-10-09', '2026-10-10']);
    expect(fechasDeNota(nota('a', 'A', '', { fecha: ['2026-10-10', 'basura', 3] }))).toEqual(['2026-10-10']);
  });
});

describe('notasPorDia', () => {
  it('una nota con dos fechas aparece en los dos días', () => {
    const indice = notasPorDia([nota('a', 'B', '@2026-10-01 y @2026-10-02'), nota('b', 'A', '@2026-10-01')]);
    expect(indice.get('2026-10-01')?.map((n) => n.titulo)).toEqual(['A', 'B']);
    expect(indice.get('2026-10-02')?.map((n) => n.titulo)).toEqual(['B']);
  });

  it('500 notas se indexan rápido', () => {
    const notas = Array.from({ length: 500 }, (_, i) => nota(String(i), `N${i}`, `@2026-10-${String((i % 28) + 1).padStart(2, '0')}`));
    const inicio = performance.now();
    const indice = notasPorDia(notas);
    expect(performance.now() - inicio).toBeLessThan(200);
    expect(indice.size).toBe(28);
  });
});

describe('cuadriculaMes', () => {
  it('6 semanas que empiezan en lunes; octubre de 2026 empieza en jueves', () => {
    const celdas = cuadriculaMes(2026, 9);
    expect(celdas).toHaveLength(42);
    expect(celdas[0]).toEqual({ dia: '2026-09-28', numero: 28, fuera: true });
    expect(celdas[3]).toEqual({ dia: '2026-10-01', numero: 1, fuera: false });
    expect(celdas.filter((c) => !c.fuera)).toHaveLength(31);
  });
});
