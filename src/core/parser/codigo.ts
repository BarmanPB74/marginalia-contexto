/**
 * Quita bloques de código (``` y ~~~) y código en línea, dejando las líneas en su sitio:
 * dentro del código no se interpreta `#`, `@` ni `[[ ]]` (docs/FORMATO_NOTAS.md, regla 1).
 * Lineal en el tamaño del texto (sin expresiones con retroceso catastrófico).
 */
export function sinCodigo(texto: string): string {
  let cerca: string | null = null;
  return texto
    .split('\n')
    .map((linea) => {
      const valla = /^\s{0,3}(`{3,}|~{3,})/.exec(linea)?.[1];
      if (cerca) {
        if (valla && valla[0] === cerca[0] && valla.length >= cerca.length) cerca = null;
        return '';
      }
      if (valla) {
        cerca = valla;
        return '';
      }
      return linea.replace(/(`+)[^`]*?\1/g, ' ');
    })
    .join('\n');
}
