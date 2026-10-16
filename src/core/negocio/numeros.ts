/**
 * Números exactos de Bar Box (regla 1 de Bar_box): nunca un float toca una cuenta.
 *
 * - Cantidades en **milésimas enteras**: 1,250 kg se guarda como 1250.
 * - Dinero en **centavos enteros**: $ 8.500 se guarda como 850000.
 *
 * Los tipos de marca (`Milesimas`, `Centavos`) son números normales en tiempo de ejecución,
 * pero el compilador no deja pasar un número cualquiera donde va dinero: hay que crearlo
 * con `milesimas()` / `centavos()` (que comprueban que sea entero seguro) o leerlo del
 * texto de una persona con `leerCantidad()` / `leerDinero()`.
 *
 * Las multiplicaciones (cantidad × precio) se hacen con BigInt: 10⁹ milésimas × 10¹⁰
 * centavos no cabe en un `number` sin perder exactitud.
 */

declare const MARCA: unique symbol;
export type Milesimas = number & { readonly [MARCA]: 'Milesimas' };
export type Centavos = number & { readonly [MARCA]: 'Centavos' };

/** Tope de cualquier importe: cien millones de pesos (el mismo de Bar_box, por cuenta). */
export const MAX_PESOS = 100_000_000;
export const MAX_CENTAVOS = MAX_PESOS * 100;
/** Tope de cualquier cantidad: un millón de unidades (en milésimas). */
export const MAX_UNIDADES = 1_000_000;
export const MAX_MILESIMAS = MAX_UNIDADES * 1000;

export class NumeroInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'NumeroInvalido';
  }
}

/** Marca un entero como milésimas. Lanza si no es entero seguro. */
export function milesimas(n: number): Milesimas {
  if (!Number.isSafeInteger(n)) throw new NumeroInvalido(`Cantidad fuera de rango: ${String(n)}`);
  return n as Milesimas;
}

/** Marca un entero como centavos. Lanza si no es entero seguro. */
export function centavos(n: number): Centavos {
  if (!Number.isSafeInteger(n)) throw new NumeroInvalido(`Valor fuera de rango: ${String(n)}`);
  return n as Centavos;
}

// --- Cantidades -------------------------------------------------------------

const CANTIDAD = /^(\d{1,7})(?:[.,](\d{1,3}))?$/;
const ERROR_CANTIDAD = `Cantidad: usa de 0 a ${MAX_UNIDADES}, con máximo tres decimales.`;

/**
 * Texto de una persona → milésimas. Igual que `domain.cantidad` de Bar_box: la coma o el
 * punto son el separador decimal ('1,125' y '1.125' → 1125), máximo tres decimales,
 * sin negativos, de 0 a 1 000 000. Rechaza 'NaN', 'Infinity', '1e3' y similares.
 */
export function leerCantidad(texto: string): Milesimas {
  const limpio = typeof texto === 'string' ? texto.trim() : '';
  const partes = CANTIDAD.exec(limpio);
  if (!partes) throw new NumeroInvalido(ERROR_CANTIDAD);
  const entero = Number(partes[1]);
  const decimales = Number((partes[2] ?? '').padEnd(3, '0'));
  const valor = entero * 1000 + decimales;
  if (valor > MAX_MILESIMAS) throw new NumeroInvalido(ERROR_CANTIDAD);
  return milesimas(valor);
}

/**
 * Milésimas → texto con coma decimal y sin ceros sobrantes: 1250 → '1,25', 3000 → '3',
 * -1250 → '-1,25'. Sin separador de miles a propósito: así `leerCantidad` lo vuelve a leer
 * igual (ida y vuelta exacta en un campo de formulario).
 */
export function mostrarCantidad(m: Milesimas): string {
  const signo = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  const entero = Math.floor(abs / 1000);
  const resto = abs % 1000;
  if (resto === 0) return `${signo}${entero}`;
  return `${signo}${entero},${String(resto).padStart(3, '0').replace(/0+$/, '')}`;
}

// --- Dinero -----------------------------------------------------------------

const MILES = /^\d{1,3}(?:\.\d{3})*$/; // 8.500 / 1.234.567
const LLANO = /^\d+$/;

function errorDinero(): NumeroInvalido {
  return new NumeroInvalido(
    `Valor: escribe de 0 a ${miles(MAX_PESOS)}, con máximo dos decimales (8.500 o 8500,50).`,
  );
}

/**
 * Texto de una persona → centavos. Regla fija de `domain.dinero` (Bar_box), sin adivinanzas:
 *
 * - Si hay coma, la coma es el decimal y los puntos son miles: '8.500,50' → 850050.
 * - Si sólo hay puntos y el último grupo tiene 3 cifras, son miles: '8.500' → 850000.
 * - Si sólo hay un punto con 1 o 2 cifras detrás, es decimal: '8500.5' → 850050.
 * - '8500,' o '8500.' son un dedo resbalado: se rechazan. '1,555' también (¿mil quinientos
 *   o uno con algo?). Cualquier otra forma se rechaza en vez de inventar un valor.
 *
 * Añadido para la pantalla: se ignoran los espacios y un '$' inicial ('$ 8.500').
 */
export function leerDinero(texto: string): Centavos {
  let t = typeof texto === 'string' ? texto.replace(/\s/g, '') : '';
  if (t.startsWith('$')) t = t.slice(1);
  if (t.length === 0 || t.length > 20) throw errorDinero();
  let entero: string;
  let decimales: string;
  const coma = t.lastIndexOf(',');
  const punto = t.lastIndexOf('.');
  if (coma >= 0) {
    entero = t.slice(0, coma);
    decimales = t.slice(coma + 1);
  } else if (punto >= 0) {
    const ultimo = t.slice(punto + 1);
    if (ultimo.length === 3 && MILES.test(t)) {
      entero = t;
      decimales = '';
    } else {
      entero = t.slice(0, punto);
      decimales = ultimo;
    }
  } else {
    entero = t;
    decimales = '';
  }
  if (!(LLANO.test(entero) || MILES.test(entero))) throw errorDinero();
  if ((coma >= 0 || entero !== t) && !decimales) throw errorDinero();
  if (decimales && !(LLANO.test(decimales) && decimales.length <= 2)) throw errorDinero();
  const valor = BigInt(entero.replace(/\./g, '')) * 100n + BigInt((decimales || '0').padEnd(2, '0'));
  if (valor > BigInt(MAX_CENTAVOS)) throw errorDinero();
  return centavos(Number(valor));
}

/** 8500000 → '8.500.000' (punto de miles, uso colombiano). */
function miles(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Centavos → texto en pesos colombianos: 850000 → '$ 8.500'; 850050 → '$ 8.500,50';
 * -850000 → '-$ 8.500'. Los centavos sólo aparecen si no son cero.
 */
export function pesos(c: Centavos): string {
  const signo = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const entero = Math.floor(abs / 100);
  const resto = abs % 100;
  return `${signo}$ ${miles(entero)}${resto ? ',' + String(resto).padStart(2, '0') : ''}`;
}

/**
 * Centavos → número plano para hojas de cálculo: '8500', '8500,50', '-120'.
 * Sin '$' ni puntos de miles, con coma decimal (configuración regional de Colombia).
 */
export function pesosPlano(c: Centavos): string {
  const signo = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  const resto = abs % 100;
  return `${signo}${Math.floor(abs / 100)}${resto ? ',' + String(resto).padStart(2, '0') : ''}`;
}

// --- Cuentas exactas --------------------------------------------------------

/** a / b redondeando la mitad hacia arriba (lejos de cero), en BigInt. b > 0. */
function dividirRedondeando(a: bigint, b: bigint): bigint {
  const signo = a < 0n ? -1n : 1n;
  const abs = a < 0n ? -a : a;
  return signo * ((abs * 2n + b) / (b * 2n));
}

/**
 * Importe de una línea: cantidad (milésimas) × precio por unidad (centavos), redondeado al
 * centavo con la mitad hacia arriba. 2 cervezas (2000) × $ 8.500 → $ 17.000;
 * 0,333 kg × $ 10.000 → $ 3.330.
 */
export function importe(cantidad: Milesimas, unitario: Centavos): Centavos {
  const valor = dividirRedondeando(BigInt(cantidad) * BigInt(unitario), 1000n);
  if (valor > BigInt(Number.MAX_SAFE_INTEGER) || valor < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new NumeroInvalido('El importe es demasiado grande.');
  }
  return centavos(Number(valor));
}

export type Descuento =
  | { readonly tipo: 'porcentaje'; /** Porcentaje entero de 0 a 100. */ readonly valor: number }
  | { readonly tipo: 'valor'; readonly valor: Centavos };

/**
 * Aplica un descuento a un total bruto. Devuelve cuánto se descuenta y el total que queda.
 *
 * Redondeo (explícito, porque cambia la plata del cajón):
 * - **Porcentaje** (entero de 0 a 100): el descuento se redondea al **peso entero** más
 *   cercano, la mitad hacia arriba. En Colombia no circulan centavos: 10 % de $ 8.555
 *   es $ 855,50 → se descuentan $ 856 y el cliente paga $ 7.699.
 * - **Valor**: se descuenta exactamente lo escrito; no puede pasar del total.
 *
 * El descuento nunca deja el total negativo.
 */
export function aplicarDescuento(total: Centavos, descuento: Descuento): { monto: Centavos; total: Centavos } {
  if (!Number.isSafeInteger(total) || total < 0) throw new NumeroInvalido('Total inválido.');
  let monto: number;
  if (descuento.tipo === 'porcentaje') {
    const p = descuento.valor;
    if (!Number.isInteger(p) || p < 0 || p > 100) {
      throw new NumeroInvalido('Descuento: el porcentaje es un número entero de 0 a 100.');
    }
    // total (centavos) × p / 100 → centavos; / 100 → pesos, redondeado; × 100 → centavos.
    monto = Number(dividirRedondeando(BigInt(total) * BigInt(p), 10_000n)) * 100;
  } else {
    monto = descuento.valor;
    if (!Number.isSafeInteger(monto) || monto < 0) throw new NumeroInvalido('Descuento inválido.');
    if (monto > total) throw new NumeroInvalido('El descuento no puede ser mayor que el total.');
  }
  monto = Math.min(monto, total);
  return { monto: centavos(monto), total: centavos(total - monto) };
}

/** Cuánto pedir para llegar a la meta: nunca negativo, sin pronósticos (`domain.sugerido`). */
export function sugerido(stock: Milesimas, meta: Milesimas): Milesimas {
  return milesimas(Math.max(0, meta - stock));
}

/** Suma de centavos (atajo tipado). */
export function sumar(valores: Iterable<Centavos>): Centavos {
  let total = 0;
  for (const v of valores) total += v;
  return centavos(total);
}
