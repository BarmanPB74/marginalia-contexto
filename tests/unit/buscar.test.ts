import { describe, expect, it } from 'vitest';
import { fragmento, normalizar, puntuar } from '../../src/core/comandos/buscar';

describe('normalizar', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizar('Bitácora ÑANDÚ')).toBe('bitacora nandu');
  });
});

describe('puntuar', () => {
  it('cada palabra escrita debe aparecer, sin importar tildes ni orden', () => {
    expect(puntuar('bitacora hoy', 'Nueva bitácora de hoy')).toBeGreaterThan(0);
    expect(puntuar('hoy bitacora', 'Nueva bitácora de hoy')).toBeGreaterThan(0);
    expect(puntuar('tema rojo', 'Tema: oscuro')).toBe(0);
  });

  it('empezar igual gana a contener', () => {
    expect(puntuar('osc', 'Oscuro')).toBeGreaterThan(puntuar('osc', 'Tema: oscuro'));
    expect(puntuar('osc', 'Tema: oscuro')).toBeGreaterThan(puntuar('cur', 'Tema: oscuro'));
  });

  it('sin consulta todo coincide', () => {
    expect(puntuar('  ', 'lo que sea')).toBeGreaterThan(0);
  });
});

describe('fragmento', () => {
  it('recorta alrededor de la palabra buscada, aunque lleve tilde', () => {
    const texto = `${'x '.repeat(60)}el acorde de séptima suena estable ${'y '.repeat(60)}`;
    const f = fragmento(texto, 'septima', 10);
    expect(f).toContain('séptima');
    expect(f.startsWith('…')).toBe(true);
    expect(f.endsWith('…')).toBe(true);
  });
});
