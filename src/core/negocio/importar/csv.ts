import { Acumulador, limpiarCelda } from './texto';
import type { Tabla } from './tipos';

const CANDIDATOS = ['\t', ';', ','] as const;

/**
 * CSV/TSV según RFC 4180 (campos entre comillas, `""` como comilla, saltos de línea dentro de
 * comillas, CRLF o LF). Separador: el de la línea `sep=;` que pone Excel si existe; si no, se
 * detecta (ver `detectarSeparador`).
 */
export function leerCsv(texto: string): Tabla {
  let t = texto;
  let sep: string | undefined;
  const pista = /^sep=(.)\r?\n/i.exec(t);
  if (pista) {
    sep = pista[1];
    t = t.slice(pista[0].length);
  }
  sep ??= detectarSeparador(t);

  const acc = new Acumulador();
  let fila: string[] = [];
  let inicio = 0; // inicio del tramo literal pendiente del campo actual
  let campo = '';
  let enComillas = false;
  let campoAbierto = false; // hay algo en la fila (aunque sea un campo vacío)
  const n = t.length;
  for (let i = 0; i < n; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"') {
        campo += t.slice(inicio, i);
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
        inicio = i + 1;
      }
      continue;
    }
    if (c === '"' && campo === '' && inicio === i) {
      enComillas = true;
      campoAbierto = true;
      inicio = i + 1;
    } else if (c === sep) {
      fila.push(limpiarCelda(campo + t.slice(inicio, i)));
      campo = '';
      inicio = i + 1;
      campoAbierto = true;
    } else if (c === '\n' || c === '\r') {
      const resto = campo + t.slice(inicio, i);
      if (campoAbierto || resto !== '') fila.push(limpiarCelda(resto));
      acc.agregar(fila);
      fila = [];
      campo = '';
      campoAbierto = false;
      if (c === '\r' && t[i + 1] === '\n') i++;
      inicio = i + 1;
    }
  }
  const resto = campo + t.slice(inicio);
  if (campoAbierto || resto !== '') {
    fila.push(limpiarCelda(resto));
    acc.agregar(fila);
  }
  return acc.cerrar();
}

/**
 * Elige el separador mirando las primeras 20 líneas no vacías (contando solo fuera de comillas):
 * gana, en orden tabulador → `;` → `,`, el primero que aparece en la primera línea (los
 * encabezados no llevan decimales) y se repite igual en al menos el 80 % de las líneas. Así
 * «General;AGUA;24,00» elige `;` aunque las comas decimales también sean constantes.
 * Si ninguno es constante, el que más aparece en la primera línea; si no hay ninguno, `,`.
 */
export function detectarSeparador(texto: string): string {
  const lineas = texto
    .slice(0, 64 * 1024)
    .split(/\r?\n|\r/)
    .filter((l) => l.trim() !== '')
    .slice(0, 20);
  const primera = lineas[0];
  if (primera === undefined) return ',';
  let mejor: string = ',';
  let mejorCuenta = 0;
  for (const sep of CANDIDATOS) {
    const cuentas = lineas.map((l) => contarFuera(l, sep));
    const h = cuentas[0] ?? 0;
    if (h === 0) continue;
    const iguales = cuentas.filter((c) => c === h).length;
    if (iguales / cuentas.length >= 0.8) return sep;
    if (h > mejorCuenta) {
      mejor = sep;
      mejorCuenta = h;
    }
  }
  return mejor;
}

function contarFuera(linea: string, sep: string): number {
  let n = 0;
  let dentro = false;
  for (const c of linea) {
    if (c === '"') dentro = !dentro;
    else if (c === sep && !dentro) n++;
  }
  return n;
}
