import { expect, test } from '@playwright/test';
import { entrar } from './sesion';

/**
 * Recepción de punta a punta, en teléfono y escritorio: crear mesa → reserva con aviso del
 * tiempo de espera → contestó → llegó y se sienta → la mesa sale con su nombre en el mapa.
 * También el inventario en pantalla dividida (escritorio). Capturas en capturas/reservas/.
 */
const VISTAS = [
  { nombre: 'telefono', width: 360, height: 800 },
  { nombre: 'ancho', width: 1280, height: 800 },
] as const;

for (const vista of VISTAS) {
  test.describe(`reservas (${vista.nombre})`, () => {
    test.use({ viewport: { width: vista.width, height: vista.height } });

    test('reservar, confirmar y sentar en la mesa', async ({ page }) => {
      const foto = (nombre: string) => page.screenshot({ path: `capturas/reservas/${vista.nombre}-${nombre}.png`, fullPage: true });
      await entrar(page, '/#/mesas');
      await page.getByRole('button', { name: 'Crear mesas' }).click();
      const crear = page.getByRole('dialog', { name: 'Crear mesas' });
      await crear.getByRole('textbox', { name: 'Hasta' }).fill('4');
      await crear.getByRole('button', { name: 'Crear mesas' }).click();
      await expect(crear).toBeHidden();
      // Caja abierta para poder sentar
      await page.getByRole('button', { name: 'Abrir caja' }).click();
      const hojaAbrir = page.getByRole('dialog', { name: 'Abrir caja' });
      for (const d of ['5', '0', '000']) await hojaAbrir.getByRole('button', { name: d, exact: true }).click();
      await hojaAbrir.getByRole('button', { name: 'Abrir caja' }).click();
      await expect(hojaAbrir).toBeHidden();

      await page.goto('/#/reservas');
      await page.getByRole('button', { name: 'Nueva reserva' }).click();
      const hoja = page.getByRole('dialog', { name: 'Nueva reserva' });
      await hoja.getByRole('textbox', { name: 'Nombre' }).fill('Familia Ruiz');
      await hoja.getByRole('textbox', { name: 'Hora' }).fill('23:58');
      await hoja.getByRole('textbox', { name: 'Personas' }).fill('5');
      await hoja.getByRole('button', { name: 'Mesa 2' }).click();
      await expect(hoja.getByRole('note', { name: 'Aviso para el cliente' })).toContainText('Si no llega a las');
      await foto('nueva');
      await hoja.getByText('Ya le avisé al cliente el tiempo de espera').click();
      await hoja.getByRole('button', { name: 'Guardar reserva' }).click();
      await expect(hoja).toBeHidden();
      const tarjeta = page.getByRole('article', { name: /Reserva de Familia Ruiz/ });
      await tarjeta.getByRole('button', { name: 'Contestó', exact: true }).click();
      await expect(tarjeta.getByText('Contestó', { exact: true }).last()).toBeVisible();
      await foto('lista');
      await tarjeta.getByRole('button', { name: 'Llegó', exact: true }).click();
      await page.getByRole('dialog', { name: 'Llegó Familia Ruiz' }).getByRole('button', { name: /Mesa 2/ }).click();
      await expect(tarjeta.getByText('Llegó', { exact: true })).toBeVisible();

      await page.goto('/#/mesas');
      await expect(page.getByRole('link', { name: /Mesa 2 \(Familia Ruiz\): Sentados/ })).toBeVisible();
      await foto('mapa');
    });
  });
}

test.describe('inventario en pantalla dividida', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('la ficha se abre al lado y la lista no se mueve al guardar', async ({ page }) => {
    await entrar(page, '/#/inventario');
    for (let i = 1; i <= 14; i++) {
      // El aviso «creado» se cierra al tocarlo
      const aviso = page.locator('.aviso-global__texto');
      if (await aviso.isVisible()) await aviso.click();
      await page.getByRole('button', { name: 'Nuevo producto' }).click();
      const hoja = page.getByRole('dialog', { name: 'Nuevo producto' });
      await hoja.getByRole('textbox', { name: 'Nombre' }).fill(`Producto ${String(i).padStart(2, '0')}`);
      await hoja.getByRole('textbox', { name: 'Precio de venta' }).fill('1000');
      await hoja.getByRole('button', { name: 'Crear producto' }).click();
      await expect(hoja).toBeHidden();
    }
    // Tras crear, la ficha queda a la derecha y la lista sigue visible
    await expect(page.getByRole('complementary', { name: 'Ficha de Producto 14' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const antes = await page.evaluate(() => window.scrollY);
    expect(antes).toBeGreaterThan(100);
    await page.getByRole('button', { name: /Producto 13/ }).first().click();
    const ficha = page.getByRole('complementary', { name: 'Ficha de Producto 13' });
    await ficha.getByRole('button', { name: 'Contar' }).click();
    await page.getByRole('dialog', { name: 'Contar Producto 13' }).getByRole('textbox', { name: '¿Cuántas hay?' }).fill('9');
    await page.getByRole('dialog', { name: 'Contar Producto 13' }).getByRole('button', { name: 'Guardar conteo' }).click();
    await expect(ficha.getByText('9 und').first()).toBeVisible();
    const despues = await page.evaluate(() => window.scrollY);
    expect(Math.abs(despues - antes)).toBeLessThan(80);
    await page.screenshot({ path: 'capturas/reservas/inventario-dividido.png' });
  });
});
