import { expect, test, type Page } from '@playwright/test';

/**
 * Ventas y caja de punta a punta, en teléfono (360 × 800) y tableta/escritorio (1280 × 800):
 * primer uso (dueño con PIN) → productos → abrir caja → vender → cerrar caja cuadrada.
 * Capturas en capturas/ventas/.
 */
const VISTAS = [
  { nombre: 'telefono', width: 360, height: 800 },
  { nombre: 'ancho', width: 1280, height: 800 },
] as const;

async function sinScrollLateral(page: Page) {
  const [ancho, visible] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(ancho).toBeLessThanOrEqual(visible);
}

async function primerUso(page: Page) {
  await page.goto('/#/inicio');
  await page.getByLabel('Tu nombre').fill('Pablo');
  await page.getByRole('button', { name: 'Seguir' }).click();
  for (let vez = 0; vez < 2; vez++) {
    for (const d of ['1', '2', '3', '4']) await page.getByRole('button', { name: d, exact: true }).click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Pablo' })).toBeVisible();
}

async function crearProducto(page: Page, nombre: string, precio: string) {
  await page.goto('/#/inventario');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  const hoja = page.getByRole('dialog', { name: 'Nuevo producto' });
  await hoja.getByLabel('Nombre').fill(nombre);
  await hoja.getByLabel('Categoría').fill('Bebidas');
  await hoja.getByLabel('Precio de venta').fill(precio);
  await hoja.getByRole('button', { name: 'Crear producto' }).click();
  await expect(hoja).toBeHidden();
}

for (const vista of VISTAS) {
  test.describe(`ventas y caja (${vista.nombre})`, () => {
    test.use({ viewport: { width: vista.width, height: vista.height } });

    test('abrir caja, vender con cambio y cerrar cuadrada', async ({ page }) => {
      const foto = (nombre: string) => page.screenshot({ path: `capturas/ventas/${vista.nombre}-${nombre}.png`, fullPage: true });
      await primerUso(page);
      await crearProducto(page, 'Cerveza', '8500');
      await crearProducto(page, 'Café', '4000');

      // Sin caja, Vender lo dice
      await page.goto('/#/vender');
      await expect(page.getByText('No hay caja abierta.')).toBeVisible();

      // Abrir caja desde Inicio con base de $ 50.000
      await page.goto('/#/inicio');
      await foto('inicio-cerrada');
      await page.getByRole('button', { name: 'Abrir caja' }).click();
      const hojaAbrir = page.getByRole('dialog', { name: 'Abrir caja' });
      for (const d of ['5', '0', '000']) await hojaAbrir.getByRole('button', { name: d, exact: true }).click();
      await hojaAbrir.getByRole('button', { name: 'Abrir caja' }).click();
      await expect(hojaAbrir).toBeHidden();
      await expect(page.getByText('Abierta', { exact: true })).toBeVisible();
      await sinScrollLateral(page);

      // Vender: 2 cervezas + 1 café = $ 21.000
      await page.getByRole('link', { name: 'Ir a vender' }).click();
      await page.getByRole('button', { name: 'Añadir Cerveza' }).click();
      await page.getByRole('button', { name: 'Añadir Cerveza' }).click();
      await page.getByRole('button', { name: 'Añadir Café' }).click();
      await sinScrollLateral(page);
      await foto('vender-pedido');
      if (vista.width < 840) {
        await page.getByRole('button', { name: /^Ver pedido/ }).click();
        await expect(page.getByRole('dialog', { name: 'Pedido' })).toBeVisible();
        await foto('vender-hoja-pedido');
        await page.getByRole('dialog', { name: 'Pedido' }).getByRole('button', { name: 'Cobrar $ 21.000' }).click();
      } else {
        await page.getByRole('complementary', { name: 'Pedido' }).getByRole('button', { name: 'Cobrar $ 21.000' }).click();
      }
      const cobrar = page.getByRole('dialog', { name: 'Cobrar' });
      await expect(cobrar.locator('.cobrar__total')).toContainText('$ 21.000');
      await cobrar.getByRole('button', { name: '$ 50.000' }).click();
      await expect(cobrar.locator('.cobrar__cambio')).toContainText('$ 29.000');
      await foto('cobrar');
      await cobrar.getByRole('button', { name: 'Confirmar venta' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Venta registrada' })).toContainText('Cambio: $ 29.000');

      // Ventas de hoy
      await page.getByRole('tab', { name: /Ventas de hoy/ }).click();
      await expect(page.getByText('2 × Cerveza, 1 × Café')).toBeVisible();
      await foto('ventas-de-hoy');

      // Cerrar caja: esperado 50.000 + 21.000 = 71.000, se cuentan 71.000 → cuadra
      await page.goto('/#/inicio');
      await page.getByRole('link', { name: 'Cerrar caja' }).click();
      await expect(page.getByText('Efectivo esperado en el cajón')).toBeVisible();
      await foto('cierre-resumen');
      await page.getByRole('button', { name: 'Contar efectivo' }).click();
      await page.getByLabel('Efectivo contado').fill('71000');
      await page.getByRole('button', { name: 'Ver diferencia' }).click();
      await expect(page.locator('.cierre__diferencia')).toContainText('Cuadra');
      await foto('cierre-diferencia');
      await page.getByRole('button', { name: 'Cerrar caja' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, cerrar caja' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Caja cerrada' })).toBeVisible();
      await expect(page.getByText('La caja está cerrada')).toBeVisible();
      await sinScrollLateral(page);
      await foto('caja-historial');
    });

    test('con la letra al 200 % no hay desplazamiento lateral', async ({ page }) => {
      await primerUso(page);
      await crearProducto(page, 'Aguardiente media botella', '45000');
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.goto('/#/caja');
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await sinScrollLateral(page);
      for (const d of ['1', '0', '000']) await page.getByRole('button', { name: d, exact: true }).click();
      await page.locator('.teclado-numerico__confirmar').click();
      await expect(page.getByText('Caja abierta. Ya puedes vender.')).toBeVisible();
      await sinScrollLateral(page);
      await page.goto('/#/vender');
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.getByRole('button', { name: 'Añadir Aguardiente media botella' }).click();
      await sinScrollLateral(page);
      await page.screenshot({ path: `capturas/ventas/${vista.nombre}-letra-200.png`, fullPage: true });
    });
  });
}
