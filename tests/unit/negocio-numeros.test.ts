import { describe, expect, it } from 'vitest';
import {
  aplicarDescuento,
  centavos,
  importe,
  leerCantidad,
  leerDinero,
  milesimas,
  mostrarCantidad,
  pesos,
  pesosPlano,
  sugerido,
  NumeroInvalido,
} from '../../src/core/negocio';

describe('cantidades en milésimas (domain.cantidad de Bar_box)', () => {
  it('lee con coma o punto decimal, hasta tres decimales', () => {
    expect(leerCantidad('1,125')).toBe(1125);
    expect(leerCantidad('1.25')).toBe(1250);
    expect(leerCantidad(' 12 ')).toBe(12000);
    expect(leerCantidad('0')).toBe(0);
    expect(leerCantidad('1000000')).toBe(1_000_000_000);
  });

  it('rechaza lo que Bar_box rechaza', () => {
    for (const malo of ['NaN', 'Infinity', '-1', '0.0001', 'abc', '1000001', '', '1e3', '1,2,3']) {
      expect(() => leerCantidad(malo), malo).toThrow(NumeroInvalido);
    }
  });

  it('muestra sin ceros sobrantes, con coma, y se lee de vuelta igual', () => {
    expect(mostrarCantidad(milesimas(-1250))).toBe('-1,25');
    expect(mostrarCantidad(milesimas(3000))).toBe('3');
    expect(mostrarCantidad(milesimas(1005))).toBe('1,005');
    for (const n of [0, 1, 999, 1000, 1250, 123456789]) expect(leerCantidad(mostrarCantidad(milesimas(n)))).toBe(n);
  });
});

describe('dinero en centavos (domain.dinero de Bar_box)', () => {
  it('sin floats: miles con punto, decimal con coma o con punto corto', () => {
    expect(leerDinero('8.500')).toBe(850000);
    expect(leerDinero('8500,50')).toBe(850050);
    expect(leerDinero('8500.50')).toBe(850050);
    expect(leerDinero('8500.5')).toBe(850050);
    expect(leerDinero('8.500,5')).toBe(850050);
    expect(leerDinero('1.234.567')).toBe(123456700);
    expect(leerDinero('$ 8.500')).toBe(850000);
    expect(leerDinero('0')).toBe(0);
    expect(leerDinero('100.000.000')).toBe(10_000_000_000);
  });

  it('rechaza las ambigüedades en vez de adivinar', () => {
    for (const malo of ['-1', 'abc', '1,555', '', '8.5.0', '1.23.456', '8500,', '8500.', '100000001', ',50', '8,500.5', '0x10']) {
      expect(() => leerDinero(malo), malo).toThrow(NumeroInvalido);
    }
  });

  it('pesos(): COP con punto de miles; centavos sólo si hay', () => {
    expect(pesos(centavos(850000))).toBe('$ 8.500');
    expect(pesos(centavos(850050))).toBe('$ 8.500,50');
    expect(pesos(centavos(0))).toBe('$ 0');
    expect(pesos(centavos(-120000000))).toBe('-$ 1.200.000');
    expect(pesos(centavos(5))).toBe('$ 0,05');
    expect(pesosPlano(centavos(-850050))).toBe('-8500,50');
  });
});

describe('cuentas exactas', () => {
  it('importe redondea al centavo, mitad hacia arriba, sin perder precisión', () => {
    expect(importe(milesimas(2000), centavos(850000))).toBe(1_700_000);
    expect(importe(milesimas(333), centavos(1_000_000))).toBe(333_000);
    expect(importe(milesimas(1), centavos(500))).toBe(1); // 0,5 centavos → 1
    // 10⁸ milésimas × 10¹⁰ centavos = 10¹⁸ antes de dividir: con floats perdería exactitud.
    expect(importe(milesimas(100_000_123), centavos(9_999_999_999))).toBe(1_000_001_229_900_000);
    expect(() => importe(milesimas(1_000_000_000), centavos(10_000_000_000))).toThrow(NumeroInvalido);
  });

  it('descuento por porcentaje: al peso entero más cercano', () => {
    // 10 % de $ 8.555 = $ 855,50 → $ 856
    expect(aplicarDescuento(centavos(855500), { tipo: 'porcentaje', valor: 10 })).toEqual({ monto: 85600, total: 769900 });
    expect(aplicarDescuento(centavos(1000000), { tipo: 'porcentaje', valor: 100 })).toEqual({ monto: 1000000, total: 0 });
    expect(aplicarDescuento(centavos(1000000), { tipo: 'porcentaje', valor: 0 })).toEqual({ monto: 0, total: 1000000 });
    expect(() => aplicarDescuento(centavos(100), { tipo: 'porcentaje', valor: 101 })).toThrow();
    expect(() => aplicarDescuento(centavos(100), { tipo: 'porcentaje', valor: 2.5 })).toThrow();
  });

  it('descuento por valor: exacto y nunca mayor que el total', () => {
    expect(aplicarDescuento(centavos(1000000), { tipo: 'valor', valor: centavos(150000) })).toEqual({ monto: 150000, total: 850000 });
    expect(() => aplicarDescuento(centavos(100), { tipo: 'valor', valor: centavos(101) })).toThrow();
  });

  it('sugerido nunca es negativo', () => {
    expect(sugerido(milesimas(20000), milesimas(15000))).toBe(0);
    expect(sugerido(milesimas(-2000), milesimas(15000))).toBe(17000);
    expect(sugerido(milesimas(5000), milesimas(15000))).toBe(10000);
  });

  it('milesimas()/centavos() sólo aceptan enteros seguros', () => {
    expect(() => centavos(1.5)).toThrow();
    expect(() => milesimas(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
