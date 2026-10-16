import { describe, expect, it } from 'vitest';
import { convencionDe, detectarConvencion, leerEscalado, leerNumero } from '../../src/core/negocio/importar';

describe('leerNumero', () => {
  it.each([
    ['997,00', 997],
    ['-2,00', -2],
    ['1.234,50', 1234.5],
    ['1,234.50', 1234.5],
    ['1.234.567', 1234567],
    ['1,234,567', 1234567],
    ['1.234.567,89', 1234567.89],
    ['24', 24],
    ['2,5', 2.5],
    ['1.5', 1.5],
    ['0,500', 0.5],
    [',25', 0.25],
    ['1234,567', 1234.567],
    ['0,1234', 0.1234],
    ['$ 12.500,00', 12500],
    ['COP 3.000,50', 3000.5],
    ['(2,00)', -2],
    ['2,00-', -2],
    ['\u22123', -3],
    ['+4', 4],
    ['  1\u00a0234,5 ', 1234.5],
  ])('«%s» → %d', (texto, esperado) => {
    expect(leerNumero(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '1,2,3', '12.34.5', '1.234,5,6', '1,23.456', '5,', '1..2', '2,5 kg', '--3', '1e5'])(
    '«%s» → null (no es número)',
    (texto) => {
      expect(leerNumero(texto)).toBeNull();
    },
  );

  it('ambiguos («1.500», «12,000») → null sin convención; resueltos con ella', () => {
    expect(leerNumero('1.500')).toBeNull();
    expect(leerNumero('12,000')).toBeNull();
    expect(leerNumero('1.500', 'es-CO')).toBe(1500);
    expect(leerNumero('1,500', 'es-CO')).toBe(1.5);
    expect(leerNumero('1.500', 'en')).toBe(1.5);
    expect(leerNumero('1,500', 'en')).toBe(1500);
    // La convención no cambia lo que no es ambiguo
    expect(leerNumero('1.5', 'es-CO')).toBe(1.5);
    expect(leerNumero('1,234.50', 'es-CO')).toBe(1234.5);
  });
});

describe('leerEscalado (milésimas y centavos enteros, sin coma flotante)', () => {
  it('convierte y redondea a la mitad alejándose de cero', () => {
    expect(leerEscalado('997,00', 3)).toBe(997_000);
    expect(leerEscalado('8,5', 3)).toBe(8_500);
    expect(leerEscalado('0,0005', 3)).toBe(1);
    expect(leerEscalado('-0,0005', 3)).toBe(-1);
    expect(leerEscalado('-0,0004', 3)).toBe(0);
    expect(Object.is(leerEscalado('-0,0004', 3), -0)).toBe(false);
    expect(leerEscalado('12.500', 2, 'es-CO')).toBe(1_250_000);
    expect(leerEscalado('0,29', 2)).toBe(29); // 0.29 * 100 en coma flotante da 28,999…
    expect(leerEscalado('1.005', 2, 'en')).toBe(101);
  });

  it('rechaza magnitudes absurdas', () => {
    expect(leerEscalado('1000000000', 3)).toBe(1_000_000_000_000);
    expect(leerEscalado('1000000001', 3)).toBeNull();
    expect(leerEscalado('99999999999999999999', 2)).toBeNull();
  });
});

describe('convención de números', () => {
  it('convencionDe solo delata cuando no es ambiguo', () => {
    expect(convencionDe('997,00')).toBe('es-CO');
    expect(convencionDe('1.234,50')).toBe('es-CO');
    expect(convencionDe('1.234.567')).toBe('es-CO');
    expect(convencionDe('1,234.50')).toBe('en');
    expect(convencionDe('2.5')).toBe('en');
    expect(convencionDe('1.500')).toBeNull();
    expect(convencionDe('24')).toBeNull();
  });

  it('detectarConvencion por mayoría; empate o sin pistas → null', () => {
    expect(detectarConvencion(['24,00', '1.500', '3'])).toBe('es-CO');
    expect(detectarConvencion(['2.5', '1,500', '3.25'])).toBe('en');
    expect(detectarConvencion(['1.500', '12'])).toBeNull();
    expect(detectarConvencion(['2,5', '2.5'])).toBeNull();
  });
});
