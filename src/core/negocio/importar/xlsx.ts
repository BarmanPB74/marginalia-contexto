import { unzipSync } from 'fflate';
import { demasiadasFilas, limpiarCelda } from './texto';
import { ErrorImportacion, LIMITES, type Tabla } from './tipos';

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Lee la primera hoja de un libro .xlsx: textos compartidos, texto en línea y números.
 * De las fórmulas solo se usa el valor que Excel dejó guardado (nunca se calcula nada).
 * Los números se devuelven sin separador de miles y con coma decimal («1234,5»), que
 * `leerNumero` entiende sin ambigüedad en la convención colombiana.
 * Limitación: las fechas llegan como el número de serie de Excel (no se leen los estilos).
 */
export function leerXlsx(bytes: Uint8Array): Tabla {
  let total = 0;
  const descomprimir = (quiero: (nombre: string) => boolean): Record<string, Uint8Array> => {
    let archivos: Record<string, Uint8Array>;
    try {
      archivos = unzipSync(bytes, {
        filter: (f) => {
          if (!quiero(f.name)) return false;
          total += f.originalSize;
          if (total > LIMITES.xlsxDescomprimido) throw bombaZip();
          return true;
        },
      });
    } catch (e) {
      if (e instanceof ErrorImportacion) throw e;
      throw new ErrorImportacion('No se pudo abrir el libro de Excel (¿está dañado?). Prueba guardarlo como .csv.');
    }
    // El tamaño declarado puede mentir: se comprueba lo realmente descomprimido
    const real = Object.values(archivos).reduce((s, d) => s + d.length, 0);
    if (real > LIMITES.xlsxDescomprimido) throw bombaZip();
    return archivos;
  };

  const base = descomprimir(
    (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml',
  );
  const libro = base['xl/workbook.xml'];
  if (!libro) {
    throw new ErrorImportacion('El archivo comprimido no es un libro de Excel. Guárdalo como .xlsx o .csv desde Excel.');
  }
  const ruta = rutaPrimeraHoja(xml(libro), base['xl/_rels/workbook.xml.rels']);
  const hoja = descomprimir((n) => n === ruta)[ruta];
  if (!hoja) throw new ErrorImportacion('El libro de Excel no tiene hojas legibles.');
  const compartidos = base['xl/sharedStrings.xml'] ? leerCompartidos(xml(base['xl/sharedStrings.xml'])) : [];
  return leerHoja(xml(hoja), compartidos);
}

function bombaZip(): ErrorImportacion {
  return new ErrorImportacion('El libro de Excel es demasiado grande al descomprimirlo.');
}

/** Parsea XML como datos: se rechaza cualquier DOCTYPE (un .xlsx legítimo nunca lo trae). */
function xml(bytes: Uint8Array): Document {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ErrorImportacion('El libro de Excel tiene texto dañado.');
  }
  if (/<!DOCTYPE/i.test(texto)) throw new ErrorImportacion('El libro de Excel tiene un formato no permitido.');
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new ErrorImportacion('El libro de Excel está dañado.');
  }
  return doc;
}

const hijos = (el: Element | Document, nombre: string): Element[] =>
  Array.from(el.getElementsByTagNameNS('*', nombre));

function rutaPrimeraHoja(libro: Document, rels: Uint8Array | undefined): string {
  const porDefecto = 'xl/worksheets/sheet1.xml';
  const hoja = hijos(libro, 'sheet')[0];
  if (!hoja || !rels) return porDefecto;
  const id =
    hoja.getAttributeNS(NS_REL, 'id') ??
    Array.from(hoja.attributes).find((a) => a.localName === 'id' && a.prefix !== null)?.value;
  if (!id) return porDefecto;
  const rel = hijos(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === id);
  const destino = rel?.getAttribute('Target');
  if (!destino) return porDefecto;
  // Relativo a xl/ («worksheets/sheet1.xml») o absoluto en el paquete («/xl/worksheets/sheet1.xml»)
  const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`;
  return /^xl\/[\w./-]+\.xml$/.test(ruta) && !ruta.includes('..') ? ruta : porDefecto;
}

/** Texto de un <si> o <is>: todos sus <t>, salvo la guía fonética (<rPh>). */
function textoRico(el: Element): string {
  return hijos(el, 't')
    .filter((t) => t.parentElement?.localName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('');
}

function leerCompartidos(doc: Document): string[] {
  return hijos(doc, 'si').map(textoRico);
}

/** «BC12» → columna 54 (desde 0); null si no es una referencia válida. */
function columnaDe(ref: string): number | null {
  const m = /^([A-Z]{1,3})\d+$/.exec(ref);
  if (!m?.[1]) return null;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function numeroATexto(valor: string): string {
  const n = Number(valor);
  if (valor.trim() === '' || !Number.isFinite(n)) return valor;
  // 15 cifras significativas, como Excel; sin notación científica
  const limpio = Number(n.toPrecision(15));
  let s = String(limpio);
  if (/e/i.test(s)) s = limpio.toFixed(10).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

function valorCelda(c: Element, compartidos: readonly string[]): string {
  const tipo = c.getAttribute('t') ?? 'n';
  const v = hijos(c, 'v')[0]?.textContent ?? '';
  switch (tipo) {
    case 's':
      return compartidos[Number(v)] ?? '';
    case 'inlineStr': {
      const is = hijos(c, 'is')[0];
      return is ? textoRico(is) : '';
    }
    case 'str': // resultado de fórmula de texto
    case 'd': // fecha ISO
      return v;
    case 'b':
      return v === '1' ? 'VERDADERO' : 'FALSO';
    case 'e': // #¡DIV/0! y similares
      return '';
    default:
      return numeroATexto(v);
  }
}

function leerHoja(doc: Document, compartidos: readonly string[]): Tabla {
  const tabla: Tabla = [];
  let siguienteFila = 0;
  for (const row of hijos(doc, 'row')) {
    const r = Number(row.getAttribute('r'));
    const indiceFila = Number.isInteger(r) && r >= 1 ? r - 1 : siguienteFila;
    siguienteFila = indiceFila + 1;
    let siguienteColumna = 0;
    let fila: string[] | undefined;
    for (const c of Array.from(row.children)) {
      if (c.localName !== 'c') continue;
      const col = columnaDe(c.getAttribute('r') ?? '') ?? siguienteColumna;
      siguienteColumna = col + 1;
      const valor = limpiarCelda(valorCelda(c, compartidos));
      if (valor === '') continue; // celdas con solo formato: no cuentan para los límites
      if (indiceFila >= LIMITES.filas) throw demasiadasFilas();
      if (col >= LIMITES.columnas) {
        throw new ErrorImportacion(`El archivo tiene más de ${LIMITES.columnas} columnas; deja solo las del inventario.`);
      }
      while (tabla.length <= indiceFila) tabla.push([]);
      fila ??= tabla[indiceFila] ?? [];
      tabla[indiceFila] = fila;
      while (fila.length < col) fila.push('');
      fila[col] = valor;
    }
  }
  return tabla;
}
