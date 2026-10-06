/**
 * Búsqueda por nombre para la paleta de comandos: notas, ajustes y herramientas.
 * Sin dependencias: minúsculas, sin tildes, y cada palabra escrita debe aparecer.
 */

/** "Bitácora Ñandú" → "bitacora nandu" (para comparar sin tildes ni mayúsculas). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Puntuación de `consulta` contra `texto` (0 = no coincide). Premia, por este orden:
 * que el texto empiece igual, que una palabra empiece igual y que simplemente contenga.
 */
export function puntuar(consulta: string, texto: string): number {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return 1;
  const destino = normalizar(texto);
  let total = 0;
  for (const p of palabras) {
    const pos = destino.indexOf(p);
    if (pos < 0) return 0;
    if (pos === 0) total += 3;
    else if (/[\s\-:/(«"]/.test(destino[pos - 1] ?? '')) total += 2;
    else total += 1;
  }
  // A igualdad, gana el texto más corto (más parecido a lo escrito)
  return total + 1 / (1 + destino.length);
}

/**
 * Fragmento del texto alrededor de la primera palabra de la consulta, para mostrar
 * por qué salió una nota. Devuelve texto plano.
 */
export function fragmento(texto: string, consulta: string, radio = 40): string {
  const primera = normalizar(consulta).split(/\s+/).find(Boolean);
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (!primera) return limpio.slice(0, radio * 2);
  // normalizar() conserva la longitud salvo en letras con tilde descompuestas: se busca sobre una copia alineada
  const alineado = [...limpio].map((c) => normalizar(c).charAt(0) || c).join('');
  const pos = alineado.indexOf(primera);
  if (pos < 0) return limpio.slice(0, radio * 2);
  const inicio = Math.max(0, pos - radio);
  const fin = Math.min(limpio.length, pos + primera.length + radio);
  return `${inicio > 0 ? '…' : ''}${limpio.slice(inicio, fin)}${fin < limpio.length ? '…' : ''}`;
}
