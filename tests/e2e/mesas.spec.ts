import { expect, test, type Page } from '@playwright/test';
import { entrar } from './sesion';

/**
 * Mesas de punta a punta, en teléfono (360 × 800) y escritorio (1280 × 800): crear mesas →
 * abrir caja → pedir en una mesa → otra ronda → pidió la cuenta → cobrar → mesa libre.
 * Capturas en capturas/mesas/.
 */
const VISTAS = [
  { nombre: 'telefono', width: 360, height: 800 },
  { nombre: 'ancho', width: 1280, height: 800 },
] as const;

async function sinScrollLateral(page: Page) {
  const [ancho, visible] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(ancho).toBeLessThanOrEqual(visible);
}

async function crearProducto(page: Page, nombre: string, precio: string) {
  await page.goto('/#/inventario');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  const hoja = page.getByRole('dialog', { name: 'Nuevo producto' });
  await hoja.getByRole('textbox', { name: 'Nombre' }).fill(nombre);
  await hoja.getByRole('textbox', { name: 'Categoría' }).fill('Bebidas');
  await hoja.getByRole('textbox', { name: 'Precio de venta' }).fill(precio);
  await hoja.getByRole('button', { name: 'Crear producto' }).click();
  await expect(hoja).toBeHidden();
}

for (const vista of VISTAS) {
  test.describe(`mesas (${vista.nombre})`, () => {
    test.use({ viewport: { width: vista.width, height: vista.height } });

    test('pedir por mesa y cobrar la cuenta', async ({ page }) => {
      const foto = (nombre: string) => page.screenshot({ path: `capturas/mesas/${vista.nombre}-${nombre}.png`, fullPage: true });
      await entrar(page, '/#/inicio');
      await crearProducto(page, 'Cerveza', '8500');
      await crearProducto(page, 'Café', '4000');

      // Mapa vacío → crear Mesa 1 a Mesa 6 en el Salón
      await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Mesas' }).click();
      await expect(page.getByText('Todavía no hay mesas.')).toBeVisible();
      await page.getByRole('button', { name: 'Crear mesas' }).click();
      const crear = page.getByRole('dialog', { name: 'Crear mesas' });
      await crear.getByRole('textbox', { name: 'Hasta' }).fill('6');
      await crear.getByRole('button', { name: 'Crear mesas' }).click();
      await expect(crear).toBeHidden();
      await expect(page.locator('a.mesa')).toHaveCount(6);

      // Sin caja: se avisa y se abre desde el mapa
      await expect(page.getByText('abre la caja para atender mesas')).toBeVisible();
      await page.getByRole('button', { name: 'Abrir caja' }).click();
      const hojaAbrir = page.getByRole('dialog', { name: 'Abrir caja' });
      for (const d of ['5', '0', '000']) await hojaAbrir.getByRole('button', { name: d, exact: true }).click();
      await hojaAbrir.getByRole('button', { name: 'Abrir caja' }).click();
      await expect(hojaAbrir).toBeHidden();
      await sinScrollLateral(page);

      // Mesa 3: primera ronda
      await page.getByRole('link', { name: 'Mesa 3: Libre' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Mesa 3' })).toBeVisible();
      await page.getByRole('button', { name: 'Añadir Cerveza' }).click();
      await page.getByRole('button', { name: 'Añadir Cerveza' }).click();
      await sinScrollLateral(page);
      await foto('ronda');
      await page.getByRole('region', { name: 'Resumen de la mesa' }).or(page.getByRole('complementary', { name: 'Cuenta de la mesa' }))
        .getByRole('button', { name: /^(Enviar|Abrir cuenta y enviar)$/ }).first().click();
      await expect(page.getByText('Pedido enviado a la cuenta.')).toBeVisible();

      // Segunda ronda
      await page.getByRole('button', { name: 'Añadir Café' }).click();
      const panel = vista.width < 840 ? page.getByRole('region', { name: 'Resumen de la mesa' }) : page.getByRole('complementary', { name: 'Cuenta de la mesa' });
      await panel.getByRole('button', { name: /^Enviar/ }).click();
      await expect(page.getByText('Pedido enviado a la cuenta.')).toBeVisible();

      // Ver la cuenta (hoja en teléfono) → pidió la cuenta → cobrar
      let cuenta = page.getByRole('complementary', { name: 'Cuenta de la mesa' });
      if (vista.width < 840) {
        await page.getByRole('button', { name: 'Ver cuenta' }).click();
        cuenta = page.getByRole('dialog', { name: 'Cuenta · Mesa 3' });
      }
      await expect(cuenta.getByText('$ 21.000').first()).toBeVisible();
      await foto('cuenta');
      await cuenta.getByRole('button', { name: 'Pidió la cuenta' }).click();
      await expect(cuenta.getByRole('button', { name: 'Ya no pide la cuenta' })).toBeVisible();
      await cuenta.getByRole('button', { name: 'Cobrar $ 21.000' }).click();
      const cobrar = page.getByRole('dialog', { name: 'Cobrar Mesa 3' });
      await cobrar.getByRole('button', { name: '$ 50.000' }).click();
      await expect(cobrar.locator('.cobrar__cambio')).toContainText('$ 29.000');
      await cobrar.getByRole('button', { name: 'Confirmar venta' }).click();
      await expect(page.getByText(/Cuenta cobrada por \$ 21\.000\. Cambio: \$ 29\.000\./)).toBeVisible();

      // De vuelta al mapa: todas libres
      await page.getByRole('button', { name: 'Mesas' }).first().click();
      await expect(page.getByRole('link', { name: 'Mesa 3: Libre' })).toBeVisible();
      await foto('mapa');
    });
  });
}
