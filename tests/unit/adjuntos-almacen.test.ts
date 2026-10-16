import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import {
  aBase64,
  borrarAdjunto,
  CARPETA_ADJUNTOS,
  deBase64,
  ErrorAdjunto,
  guardarAdjunto,
  leerAdjunto,
  MAX_ORIGEN,
  MAX_SIN_REDUCIR,
  tipoPorFirma,
} from '../../src/features/adjuntos/adjuntos';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PDF = [...'%PDF-1.7\n'].map((c) => c.charCodeAt(0));

/** Bytes que empiezan con una firma y se rellenan hasta `largo`. */
function archivo(firma: readonly number[], largo = 64): Uint8Array {
  const b = new Uint8Array(largo);
  b.set(firma);
  for (let i = firma.length; i < largo; i++) b[i] = i % 251;
  return b;
}

const almacenNuevo = () => crearAlmacen(new DiscoMemoria());
const sinCanvas = () => Promise.resolve(null);

describe('adjuntos: tipo por contenido', () => {
  it('reconoce JPEG, PNG, WebP y PDF por su firma, no por el nombre', () => {
    expect(tipoPorFirma(archivo(JPEG))).toBe('image/jpeg');
    expect(tipoPorFirma(archivo(PNG))).toBe('image/png');
    const webp = archivo([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
    expect(tipoPorFirma(webp)).toBe('image/webp');
    expect(tipoPorFirma(archivo(PDF))).toBe('application/pdf');
    expect(tipoPorFirma(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull();
    expect(tipoPorFirma(new Uint8Array())).toBeNull();
  });

  it('rechaza una firma inválida aunque el nombre diga .jpg', async () => {
    const a = almacenNuevo();
    const html = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    await expect(guardarAdjunto(a, { bytes: html, nombre: 'factura.jpg' }, { reducir: sinCanvas })).rejects.toBeInstanceOf(ErrorAdjunto);
    expect(await a.listar(CARPETA_ADJUNTOS)).toEqual([]);
  });

  it('rechaza archivos vacíos y de más de 10 MB', async () => {
    const a = almacenNuevo();
    await expect(guardarAdjunto(a, { bytes: new Uint8Array(), nombre: 'x.pdf' })).rejects.toThrow(/vacío/);
    await expect(guardarAdjunto(a, { bytes: archivo(PDF, MAX_ORIGEN + 1), nombre: 'x.pdf' })).rejects.toThrow(/10 MB/);
  });

  it('sin canvas, una imagen de más de 3 MB no se guarda', async () => {
    const a = almacenNuevo();
    await expect(guardarAdjunto(a, { bytes: archivo(PNG, MAX_SIN_REDUCIR + 1), nombre: 'foto.png' }, { reducir: sinCanvas })).rejects.toThrow(/3 MB/);
  });
});

describe('adjuntos: ida y vuelta', () => {
  it('guarda en negocio/adjuntos/<ulid>.json y lee los mismos bytes', async () => {
    const a = almacenNuevo();
    const bytes = archivo(PDF, 5000);
    const id = await guardarAdjunto(a, { bytes, nombre: 'C:\\facturas\\proveedor\nraro.pdf' });
    expect(id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    expect(await a.listar(CARPETA_ADJUNTOS)).toEqual([`${id}.json`]);
    const guardado = JSON.parse((await a.leer(`${CARPETA_ADJUNTOS}/${id}.json`)) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(guardado).sort()).toEqual(['datosBase64', 'nombre', 'tamano', 'tipo']);
    const leido = await leerAdjunto(a, id);
    expect(leido?.tipo).toBe('application/pdf');
    expect(leido?.nombre).toBe('proveedorraro.pdf');
    expect(leido?.tamano).toBe(5000);
    expect([...(leido?.bytes ?? [])]).toEqual([...bytes]);
  });

  it('las imágenes se reducen a JPEG con el reductor; uno roto no cuela otro tipo', async () => {
    const a = almacenNuevo();
    const reducida = archivo(JPEG, 300);
    const id = await guardarAdjunto(a, { bytes: archivo(PNG, 4000), nombre: 'foto.png' }, { reducir: () => Promise.resolve(reducida) });
    const leido = await leerAdjunto(a, id);
    expect(leido?.tipo).toBe('image/jpeg');
    expect(leido?.nombre).toBe('foto.jpg');
    expect(leido?.tamano).toBe(300);

    const otro = await guardarAdjunto(a, { bytes: archivo(PNG, 400), nombre: 'p.png' }, { reducir: () => Promise.resolve(archivo(PDF)) });
    expect((await leerAdjunto(a, otro))?.tipo).toBe('image/png');
  });

  it('un id raro o un archivo alterado no se sirve', async () => {
    const a = almacenNuevo();
    expect(await leerAdjunto(a, '../../negocio/diario')).toBeNull();
    const id = await guardarAdjunto(a, { bytes: archivo(PDF), nombre: 'f.pdf' });
    // Alguien cambia el contenido por HTML conservando el tipo «PDF»
    await a.escribir(
      `${CARPETA_ADJUNTOS}/${id}.json`,
      JSON.stringify({ tipo: 'application/pdf', nombre: 'f.pdf', tamano: 5, datosBase64: aBase64(new TextEncoder().encode('<html>')) }),
    );
    await expect(leerAdjunto(a, id)).rejects.toBeInstanceOf(ErrorAdjunto);
    await borrarAdjunto(a, id);
    expect(await leerAdjunto(a, id)).toBeNull();
  });

  it('base64 por trozos aguanta archivos grandes', () => {
    const grande = archivo(PDF, 200_000);
    expect([...deBase64(aBase64(grande))]).toEqual([...grande]);
  });
});
