import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { detectarFormato, ErrorImportacion, LIMITES, leerTabla } from '../../src/core/negocio/importar';

const fixture = (nombre: string) => new Uint8Array(readFileSync(`tests/unit/fixtures/${nombre}`));
const texto = (s: string) => new TextEncoder().encode(s);
/** Codifica en latin1/windows-1252 (cada carácter < 256 es un byte). */
const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

/** .xlsx mínimo generado en la prueba: workbook + rels + sharedStrings + sheet1. */
function xlsx(hoja: string, compartidos: string[] = [], extra: Record<string, string> = {}): Uint8Array {
  const si = compartidos.map((s) => `<si><t xml:space="preserve">${s}</t></si>`).join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Inventario" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${si}</sst>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${hoja}</sheetData></worksheet>`,
    ),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, strToU8(v)])),
  });
}

const error = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorImportacion);
    return (e as Error).message;
  }
  throw new Error('se esperaba un error');
};

describe('leerTabla: tabla HTML con cabecera de Excel («.xls» que no es binario)', () => {
  it('lee la tabla limpiando &nbsp;, espacios dobles y conservando tildes', () => {
    const tabla = leerTabla(fixture('inventario-tabla.xls'), 'inventario.xls');
    expect(tabla[0]).toEqual(['Ubicación', 'Nombre', 'Inicial', 'Final', 'Diferencia']);
    expect(tabla[1]).toEqual(['General', 'AGUA CON GAS', '24,00', '23,00', '1,00']);
    expect(tabla[2]?.[1]).toBe('Limonada de Coco Grande');
    expect(tabla[3]?.[3]).toBe('-2,00');
    expect(tabla[5]?.[1]).toBe('Piña Colada Ñapa');
    expect(tabla[7]?.[1]).toBe('Cerveza Artesanal Rubia');
    expect(tabla[11]).toEqual([]); // fila vacía conservada (los números de fila no se corren)
    expect(tabla).toHaveLength(13);
    expect(detectarFormato(fixture('inventario-tabla.xls'))).toBe('html');
  });

  describe('HTML hostil', () => {
    afterEach(() => {
      delete (globalThis as Record<string, unknown>).__importarEjecutado;
    });

    it('nunca ejecuta scripts ni manejadores; solo lee texto; salta la tabla de título', async () => {
      const tabla = leerTabla(fixture('inventario-hostil.html'), 'hostil.html');
      // Damos tiempo a que un onerror asíncrono se disparara si el documento no fuera inerte
      await new Promise((r) => setTimeout(r, 50));
      expect((globalThis as Record<string, unknown>).__importarEjecutado).toBeUndefined();
      expect(tabla).toEqual([
        ['Producto', 'Existencia'],
        ['Ron Viejo', '5'],
        ['Ginebra Seca', '2,5'],
        ['Vino Tinto', '7'],
      ]);
      expect(JSON.stringify(tabla)).not.toMatch(/script|onerror|globalThis|<|>/);
    });
  });

  it('HTML sin tabla → error claro', () => {
    expect(error(() => leerTabla(texto('<html><body><p>hola</p></body></html>'), 'x.xls'))).toMatch(/ninguna tabla/);
  });
});

describe('leerTabla: CSV / TSV', () => {
  it('CSV con «;», línea sep=, comillas RFC 4180 y salto de línea dentro de comillas', () => {
    const tabla = leerTabla(fixture('inventario-puntoycoma.csv'), 'inventario.csv');
    expect(tabla).toEqual([
      ['Código', 'Producto', 'Categoría', 'Existencia', 'Precio venta'],
      ['A-01', 'Sándwich "Especial"', 'Comidas', '12', '12.500'],
      ['A-02', 'Empanada; de carne', 'Comidas', '1,5', '3.000'],
      ['A-03', 'Jugo de mora', 'Bebidas', '-3', '4.500,50'],
    ]);
  });

  it('detecta «;» aunque las comas decimales sean constantes, y quita el BOM UTF-8', () => {
    const csv = '\ufeffNombre;Final\nAgua;24,00\nTé;3,50\n';
    expect(leerTabla(texto(csv), 'a.csv')).toEqual([
      ['Nombre', 'Final'],
      ['Agua', '24,00'],
      ['Té', '3,50'],
    ]);
  });

  it('detecta «,» con comillas y tabulador', () => {
    expect(leerTabla(texto('nombre,cantidad\n"Ron, añejo",3\nVino,"1,5"\n'), 'a.csv')).toEqual([
      ['nombre', 'cantidad'],
      ['Ron, añejo', '3'],
      ['Vino', '1,5'],
    ]);
    expect(leerTabla(texto('nombre\tcantidad\r\nRon; añejo\t3,5\r\n'), 'a.txt')).toEqual([
      ['nombre', 'cantidad'],
      ['Ron; añejo', '3,5'],
    ]);
  });

  it('CSV en latin1/windows-1252 (Excel en Windows) se lee con tildes y eñes', () => {
    const tabla = leerTabla(latin1('Producto;Categoría\nPiña;Frutas\nLimón;Cítricos\n'), 'viejo.csv');
    expect(tabla).toEqual([
      ['Producto', 'Categoría'],
      ['Piña', 'Frutas'],
      ['Limón', 'Cítricos'],
    ]);
  });

  it('texto UTF-16 con BOM (Excel «Texto Unicode»)', () => {
    const s = 'Nombre\tFinal\nCafé\t2\n';
    const bytes = new Uint8Array(2 + s.length * 2);
    bytes.set([0xff, 0xfe]);
    for (let i = 0; i < s.length; i++) bytes[2 + i * 2] = s.charCodeAt(i);
    expect(leerTabla(bytes, 'a.txt')).toEqual([
      ['Nombre', 'Final'],
      ['Café', '2'],
    ]);
  });
});

describe('leerTabla: XLSX', () => {
  it('lee textos compartidos, en línea, números y valores cacheados de fórmulas', () => {
    const hoja =
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>23</v></c><c r="C2"><f>B2*1000</f><v>12500</v></c></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>Café </t><r><t>Oscuro</t></r></is></c><c r="B3"><v>-2.5</v></c><c r="C3" t="str"><f>"x"</f><v>sin precio</v></c></row>' +
      '<row r="5"><c r="B5" s="1"/><c r="C5"><v>1.234</v></c><c r="A5" t="e"><v>#DIV/0!</v></c></row>' +
      '<row r="6"><c r="A6" t="s"><v>4</v></c><c r="D6"><v>0.30000000000000004</v></c></row>';
    const tabla = leerTabla(xlsx(hoja, ['Nombre', 'Final', 'Precio', 'Agua con gas', 'Té &amp; limón']), 'libro.xlsx');
    expect(tabla).toEqual([
      ['Nombre', 'Final', 'Precio'],
      ['Agua con gas', '23', '12500'],
      ['Café Oscuro', '-2,5', 'sin precio'],
      [],
      ['', '', '1,234'],
      ['Té & limón', '', '', '0,3'],
    ]);
  });

  it('un ZIP que no es libro de Excel → error claro', () => {
    const zip = zipSync({ 'notas/a.md': strToU8('hola') });
    expect(error(() => leerTabla(zip, 'copia.zip'))).toMatch(/no es un libro de Excel/);
  });

  it('XML con DOCTYPE (posible bomba de entidades) → rechazado', () => {
    const malo = xlsx('', [], {
      'xl/workbook.xml': '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><workbook/>',
    });
    expect(error(() => leerTabla(malo, 'malo.xlsx'))).toMatch(/formato no permitido/);
  });

  it('bomba zip: lo descomprimido pasa de 50 MB → error', () => {
    const relleno = 'A'.repeat(LIMITES.xlsxDescomprimido + 10);
    const bomba = xlsx('<row r="1"><c r="A1" t="s"><v>0</v></c></row>', [relleno]);
    expect(bomba.length).toBeLessThan(LIMITES.bytes);
    expect(error(() => leerTabla(bomba, 'bomba.xlsx'))).toMatch(/demasiado grande/);
  });

  it('celdas con valor más allá de la fila 20 000 o la columna 50 → error', () => {
    expect(error(() => leerTabla(xlsx('<row r="20001"><c r="A20001"><v>1</v></c></row>'), 'a.xlsx'))).toMatch(
      /más de 20.000 filas/,
    );
    expect(error(() => leerTabla(xlsx('<row r="1"><c r="AZ1"><v>1</v></c></row>'), 'a.xlsx'))).toMatch(
      /más de 50 columnas/,
    );
    // Celdas solo con formato muy lejos no cuentan
    expect(leerTabla(xlsx('<row r="1"><c r="A1"><v>1</v></c></row><row r="900000"><c r="ZZ900000" s="2"/></row>'), 'a.xlsx')).toEqual([['1']]);
  });
});

describe('leerTabla: formatos no soportados y límites', () => {
  it('.xls binario real (BIFF/OLE) → «Guárdalo como .xlsx o .csv desde Excel»', () => {
    const bytes = new Uint8Array(1024);
    bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const msg = error(() => leerTabla(bytes, 'inventario.xls'));
    expect(msg).toMatch(/Guárdalo como \.xlsx o \.csv desde Excel/);
    expect(msg).toContain('inventario.xls');
  });

  it('archivo de más de 10 MB → error sin intentar leerlo', () => {
    expect(error(() => leerTabla(new Uint8Array(LIMITES.bytes + 1), 'enorme.csv'))).toMatch(/10 MB/);
  });

  it('más de 20 000 filas → error', () => {
    const csv = 'nombre;cantidad\n' + 'x;1\n'.repeat(LIMITES.filas);
    expect(error(() => leerTabla(texto(csv), 'largo.csv'))).toMatch(/más de 20.000 filas/);
    // Justo en el límite sí se acepta
    expect(leerTabla(texto('nombre;cantidad\n' + 'x;1\n'.repeat(LIMITES.filas - 1)), 'ok.csv')).toHaveLength(LIMITES.filas);
  });

  it('más de 50 columnas → error; las vacías del final no cuentan', () => {
    expect(error(() => leerTabla(texto(Array.from({ length: 51 }, (_, i) => `c${i}`).join(';')), 'ancho.csv'))).toMatch(
      /más de 50 columnas/,
    );
    expect(leerTabla(texto('a;b' + ';'.repeat(100) + '\n1;2\n'), 'ok.csv')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('celdas de más de 500 caracteres se recortan', () => {
    const tabla = leerTabla(texto(`nombre;cantidad\n${'ñ'.repeat(2000)};1\n`), 'a.csv');
    expect(tabla[1]?.[0]).toHaveLength(LIMITES.caracteresCelda);
  });

  it('archivo vacío, binario o sin datos → error', () => {
    expect(error(() => leerTabla(new Uint8Array(0), 'v.csv'))).toMatch(/vacío/);
    expect(error(() => leerTabla(new Uint8Array([1, 0, 2, 0, 0, 0]), 'b.bin'))).toMatch(/no es una hoja de cálculo/);
    expect(error(() => leerTabla(texto('\n\n;;;\n'), 'v.csv'))).toMatch(/no tiene datos/);
  });

  it('hoja XML de Excel 2003 → error claro', () => {
    const xml = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"></Workbook>';
    expect(error(() => leerTabla(texto(xml), 'a.xls'))).toMatch(/Guárdalo como \.xlsx o \.csv/);
  });
});
