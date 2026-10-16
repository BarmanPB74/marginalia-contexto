import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { crearAlmacen, DiscoMemoria } from '../../src/core/almacen/almacen';
import { centavos, milesimas, Negocio } from '../../src/core/negocio';
import { CopiaInvalida, crearCopiaNegocio, restaurarCopiaNegocio } from '../../src/core/negocio/copia';

async function negocioConDatos() {
  const almacen = crearAlmacen(new DiscoMemoria());
  const n = await Negocio.crear(almacen, { iteracionesPin: 1000 });
  await n.crearUsuario({ nombre: 'Dueña', rol: 'dueno', pin: '1234' });
  const p = await n.crearProducto({ nombre: 'Tinto', categoria: 'Calientes', unidad: 'unidad', precio: centavos(300000) });
  await n.ajustarInventario({ productoId: p.id, delta: milesimas(10000), motivo: 'correccion' });
  await n.abrirCaja(centavos(0));
  await n.vender({ lineas: [{ productoId: p.id, cantidad: milesimas(2000) }], pagos: [{ forma: 'efectivo' }] });
  await almacen.escribir('negocio/adjuntos/01JABCDEFGHJKMNPQRSTVWXYZ0.json', '{"tipo":"image/png"}');
  return { almacen, n, productoId: p.id };
}

describe('copia completa del negocio', () => {
  it('ida y vuelta: en un teléfono nuevo vuelve todo (usuarios, inventario, ventas, adjuntos)', async () => {
    const { almacen, productoId } = await negocioConDatos();
    const zip = await crearCopiaNegocio(almacen);
    expect(Object.keys(unzipSync(zip))).toContain('LEEME.txt');

    const nuevo = crearAlmacen(new DiscoMemoria());
    const movimientos = await restaurarCopiaNegocio(nuevo, zip);
    expect(movimientos).toBeGreaterThan(4);
    const n2 = await Negocio.crear(nuevo, { iteracionesPin: 1000 });
    expect(n2.primerUso).toBe(false);
    expect(n2.estado.caja?.ventas).toBe(1);
    expect(n2.estado.stock[productoId]).toBe(8000);
    expect(await nuevo.leer('negocio/adjuntos/01JABCDEFGHJKMNPQRSTVWXYZ0.json')).toContain('image/png');
    expect((await n2.iniciarSesion(n2.usuarios()[0]?.id ?? '', '1234')).ok).toBe(true);
  });

  it('no restaura encima de un negocio con movimientos', async () => {
    const { almacen } = await negocioConDatos();
    const zip = await crearCopiaNegocio(almacen);
    await expect(restaurarCopiaNegocio(almacen, zip)).rejects.toBeInstanceOf(CopiaInvalida);
  });

  it('una copia alterada no se acepta y no deja nada escrito', async () => {
    const { almacen } = await negocioConDatos();
    const archivos = unzipSync(await crearCopiaNegocio(almacen));
    const dia = Object.keys(archivos).find((r) => r.startsWith('negocio/diario/'));
    if (!dia) throw new Error('sin diario');
    const texto = new TextDecoder().decode(archivos[dia]).replace('"Tinto"', '"Tinta"');
    archivos[dia] = strToU8(texto);
    const nuevo = crearAlmacen(new DiscoMemoria());
    await expect(restaurarCopiaNegocio(nuevo, zipSync(archivos))).rejects.toBeInstanceOf(CopiaInvalida);
    expect(await nuevo.listar('negocio/diario')).toEqual([]);
  });

  it('ignora rutas raras (zip-slip) y rechaza lo que no es una copia', async () => {
    const raro = zipSync({ '../../fuera.json': strToU8('x'), 'negocio/diario/../x.json': strToU8('x') });
    await expect(restaurarCopiaNegocio(crearAlmacen(new DiscoMemoria()), raro)).rejects.toThrow(/no trae movimientos/);
    await expect(restaurarCopiaNegocio(crearAlmacen(new DiscoMemoria()), new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(CopiaInvalida);
  });
});
