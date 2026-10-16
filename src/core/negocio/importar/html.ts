import { limpiarCelda, Acumulador, demasiadasFilas } from './texto';
import { ErrorImportacion, LIMITES, type Tabla } from './tipos';

/**
 * Lee la primera tabla HTML con datos (así son los «.xls» que en realidad son una página web con
 * cabecera de Excel). `DOMParser` crea un documento inerte: no ejecuta `<script>`, no carga
 * imágenes ni dispara `onerror`. Además se eliminan scripts y estilos antes de leer, y solo se usa
 * `textContent` de las celdas: nunca se inserta HTML en la página.
 */
export function leerHtml(texto: string): Tabla {
  const doc = new DOMParser().parseFromString(texto, 'text/html');
  doc.querySelectorAll('script, style, template, noscript, iframe, object, embed').forEach((e) => e.remove());
  // Un <br> dentro de una celda separa palabras
  doc.querySelectorAll('br').forEach((br) => br.replaceWith(' '));

  const tablas = Array.from(doc.querySelectorAll('table'));
  if (tablas.length === 0) throw new ErrorImportacion('El archivo no contiene ninguna tabla.');
  let primeraNoVacia: Tabla | undefined;
  for (const tabla of tablas) {
    const filas = leerTablaHtml(tabla);
    if (tieneDatos(filas)) return filas;
    if (!primeraNoVacia && filas.length > 0) primeraNoVacia = filas;
  }
  if (primeraNoVacia) return primeraNoVacia;
  throw new ErrorImportacion('Las tablas del archivo están vacías.');
}

/** «Con datos»: al menos dos filas con dos o más celdas llenas (un título suelto no cuenta). */
function tieneDatos(filas: Tabla): boolean {
  let n = 0;
  for (const f of filas) if (f.filter((c) => c !== '').length >= 2 && ++n >= 2) return true;
  return false;
}

function leerTablaHtml(tabla: HTMLTableElement): Tabla {
  // `rows` solo da las filas propias de esta tabla (no las de tablas anidadas)
  const filas = tabla.rows;
  if (filas.length > LIMITES.filas) throw demasiadasFilas();
  const acc = new Acumulador();
  for (const tr of Array.from(filas)) {
    const fila: string[] = [];
    for (const celda of Array.from(tr.cells)) {
      fila.push(limpiarCelda(celda.textContent ?? ''));
      // Celdas combinadas: se rellenan con vacías para no correr las columnas
      const extra = Math.min(Math.max(celda.colSpan, 1), LIMITES.columnas + 1) - 1;
      for (let i = 0; i < extra; i++) fila.push('');
      if (fila.length > LIMITES.columnas * 4) break; // el Acumulador decide si sobran (tras quitar vacías)
    }
    acc.agregar(fila);
  }
  return acc.cerrar();
}
