import { LIMITES, type Convencion } from './tipos';

/**
 * Lectura tolerante de números escritos a mano o exportados (colombianos y anglosajones).
 *
 * Reglas, en orden:
 * 1. Se ignoran espacios (también &nbsp;), el símbolo `$` y las siglas `COP`/`USD`.
 * 2. Signo: `-` o `+` al inicio, `-` al final («2,00-») o paréntesis «(2,00)» → negativo.
 *    También se acepta el signo menos tipográfico «−».
 * 3. Solo quedan dígitos, `.` y `,`; cualquier otra cosa → null.
 * 4. Sin separadores: entero («997»).
 * 5. Con `.` y `,` a la vez: el que aparece **de último** es el decimal y debe aparecer una sola
 *    vez; el otro es de miles y debe agrupar de a 3 («1.234,50» y «1,234.50» → 1234,5).
 * 6. Un solo tipo de separador repetido: es de miles y debe agrupar de a 3 («1.234.567»).
 * 7. Un solo separador, una vez:
 *    - si después hay 1, 2 o 4+ dígitos, es decimal («997,00», «2,5», «1.5», «0,1234»);
 *    - si después hay exactamente 3 dígitos y antes hay «0», nada o más de 3 dígitos, es decimal
 *      («0,500», «,250», «1234,567»);
 *    - si después hay 3 dígitos y antes 1–3 dígitos («1.500», «12,000») es **ambiguo**: se
 *      resuelve con `convencion` (`es-CO`: «1.500» = 1500 y «1,500» = 1,5; `en`: al revés) y,
 *      sin convención, devuelve null.
 * 8. Un separador al final («5,») o seguido de otro → null.
 *
 * Devuelve null si el texto está vacío, no es un número o es ambiguo.
 */
export function leerNumero(texto: string, convencion?: Convencion): number | null {
  const d = analizar(texto, convencion);
  return d ? Number(`${d.negativo ? '-' : ''}${d.entero}.${d.fraccion || '0'}`) : null;
}

/**
 * Convierte a entero escalado (×1000 para milésimas, ×100 para centavos) sin errores de coma
 * flotante: se opera sobre los dígitos. Redondea a la mitad alejándose de cero.
 * null si no es un número, es ambiguo o pasa de `LIMITES.magnitudMaxima` unidades.
 */
export function leerEscalado(texto: string, decimales: 2 | 3, convencion?: Convencion): number | null {
  const d = analizar(texto, convencion);
  if (!d) return null;
  const entero = d.entero.replace(/^0+(?=\d)/, '');
  if (entero.length > 10 || Number(entero) > LIMITES.magnitudMaxima) return null;
  const frac = d.fraccion.padEnd(decimales + 1, '0');
  let n = Number(entero) * 10 ** decimales + Number(frac.slice(0, decimales) || '0');
  if (Number(frac[decimales]) >= 5) n += 1;
  if (n === 0) return 0;
  return d.negativo ? -n : n;
}

/** Qué convención delata un texto por sí solo (null si no delata ninguna). */
export function convencionDe(texto: string): Convencion | null {
  const n = limpiar(texto);
  if (!n) return null;
  const { cuerpo } = n;
  const ip = cuerpo.lastIndexOf('.');
  const ic = cuerpo.lastIndexOf(',');
  if (ip >= 0 && ic >= 0) return ic > ip ? 'es-CO' : 'en';
  const sep = ip >= 0 ? '.' : ic >= 0 ? ',' : null;
  if (!sep) return null;
  const partes = cuerpo.split(sep);
  const decimal = sep === ',' ? 'es-CO' : 'en';
  const miles = sep === ',' ? 'en' : 'es-CO';
  if (partes.length > 2) return gruposValidos(partes) ? miles : null;
  const [antes = '', despues = ''] = partes;
  if (despues.length !== 3) return despues.length > 0 ? decimal : null;
  if (antes === '' || antes === '0' || antes.length > 3) return decimal;
  return null; // ambiguo
}

/** Convención mayoritaria entre varios textos; null si no hay pistas o hay empate. */
export function detectarConvencion(textos: Iterable<string>): Convencion | null {
  let co = 0;
  let en = 0;
  for (const t of textos) {
    const c = convencionDe(t);
    if (c === 'es-CO') co++;
    else if (c === 'en') en++;
  }
  if (co === en) return null;
  return co > en ? 'es-CO' : 'en';
}

interface Partes {
  negativo: boolean;
  entero: string;
  fraccion: string;
}

function limpiar(texto: string): { negativo: boolean; cuerpo: string } | null {
  let s = texto.replace(/\s+/g, '').replace(/\u2212/g, '-').replace(/^(COP|USD|US)?\$?/i, '').replace(/(COP|USD)$/i, '');
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^\$/, '');
  if (s.startsWith('-') || s.startsWith('+')) {
    negativo = negativo !== s.startsWith('-');
    s = s.slice(1);
  } else if (s.endsWith('-')) {
    negativo = !negativo;
    s = s.slice(0, -1);
  }
  s = s.replace(/^\$/, '');
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  return { negativo, cuerpo: s };
}

function gruposValidos(partes: readonly string[]): boolean {
  const [primero, ...resto] = partes;
  return !!primero && /^\d{1,3}$/.test(primero) && resto.every((g) => /^\d{3}$/.test(g));
}

function analizar(texto: string, convencion?: Convencion): Partes | null {
  const l = limpiar(texto);
  if (!l) return null;
  const { negativo, cuerpo } = l;
  const ip = cuerpo.lastIndexOf('.');
  const ic = cuerpo.lastIndexOf(',');

  // Regla 4
  if (ip < 0 && ic < 0) return { negativo, entero: cuerpo, fraccion: '' };

  // Regla 5
  if (ip >= 0 && ic >= 0) {
    const decimal = ic > ip ? ',' : '.';
    const miles = decimal === ',' ? '.' : ',';
    const [izq = '', der = '', ...sobra] = cuerpo.split(decimal);
    if (sobra.length > 0 || !/^\d+$/.test(der)) return null;
    const grupos = izq.split(miles);
    if (!gruposValidos(grupos)) return null;
    return { negativo, entero: grupos.join(''), fraccion: der };
  }

  const sep = ip >= 0 ? '.' : ',';
  const partes = cuerpo.split(sep);
  // Regla 6
  if (partes.length > 2) return gruposValidos(partes) ? { negativo, entero: partes.join(''), fraccion: '' } : null;

  // Reglas 7 y 8
  const [antes = '', despues = ''] = partes;
  if (despues === '') return null;
  const comoDecimal: Partes = { negativo, entero: antes || '0', fraccion: despues };
  if (despues.length !== 3 || antes === '' || antes === '0' || antes.length > 3) return comoDecimal;
  if (!convencion) return null;
  const esDecimal = (sep === ',') === (convencion === 'es-CO');
  return esDecimal ? comoDecimal : { negativo, entero: antes + despues, fraccion: '' };
}
