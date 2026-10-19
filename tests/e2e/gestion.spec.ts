import { expect, test, type Page } from '@playwright/test';

/**
 * Gestión de Stark de punta a punta: primer uso → Más → Contabilidad (verificar) → crear cajero →
 * cambiar de usuario → entrar como cajero → Más sin Contabilidad. En teléfono y en tableta.
 * Capturas en capturas/gestion/.
 */
const TAMANOS = [
  { nombre: 'telefono', width: 360, height: 800 },
  { nombre: 'tableta', width: 1280, height: 800 },
] as const;

async function pin(page: Page, digitos: string) {
  for (const d of digitos) await page.getByRole('button', { name: d, exact: true }).click();
}

async function irAMas(page: Page) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Más' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Más' })).toBeVisible();
}

for (const t of TAMANOS) {
  test.describe(`gestión en ${t.width}×${t.height}`, () => {
    test.use({ viewport: { width: t.width, height: t.height } });

    test('primer uso → crear cajero → cambiar de usuario → el cajero no ve Contabilidad', async ({ page }) => {
      const captura = (nombre: string) => page.screenshot({ path: `capturas/gestion/${nombre}-${t.nombre}.png`, fullPage: true });
      await page.goto('/');

      // Primer uso: la dueña y su PIN dos veces
      await expect(page.getByRole('heading', { level: 1, name: 'Bienvenido' })).toBeVisible();
      await page.getByLabel('Tu nombre').fill('Dueña');
      await page.getByRole('button', { name: 'Seguir' }).click();
      await pin(page, '1234');
      await pin(page, '1234');

      // Más (dueña): todas las secciones
      await irAMas(page);
      const otras = page.getByRole('list', { name: 'Otras secciones' });
      await expect(otras.getByRole('link', { name: /Contabilidad/ })).toBeVisible();
      await expect(otras.getByRole('link', { name: /Usuarios/ })).toBeVisible();
      await captura('mas-duena');

      // Contabilidad: aviso fijo y registro íntegro
      await otras.getByRole('link', { name: /Contabilidad/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Contabilidad' })).toBeVisible();
      await expect(page.getByText('Registro interno de apoyo. No es factura electrónica ni contabilidad oficial')).toBeVisible();
      await page.getByRole('button', { name: 'Verificar registro' }).click();
      await expect(page.getByText(/Registro íntegro: 1 movimiento/)).toBeVisible();
      await captura('contabilidad');

      // Usuarios: crear a Carlos, cajero, con PIN 5678 dos veces
      await irAMas(page);
      await page.getByRole('list', { name: 'Otras secciones' }).getByRole('link', { name: /Usuarios/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
      await page.getByRole('button', { name: 'Nueva persona' }).click();
      const hoja = page.getByRole('dialog', { name: 'Nueva persona' });
      await hoja.getByLabel('Nombre').fill('Carlos');
      await hoja.getByRole('button', { name: 'Cajero', exact: true }).click();
      await expect(hoja.getByText(/Puede abrir la caja/)).toBeVisible();
      await captura('usuarios-nueva');
      await hoja.getByRole('button', { name: 'Seguir: crear su PIN' }).click();
      await pin(page, '5678');
      await pin(page, '5678');
      await expect(page.getByText('Listo: «Carlos» ya puede entrar con su PIN.')).toBeVisible();
      await captura('usuarios');

      // Cambiar de usuario → entrar como Carlos
      await page.getByRole('button', { name: 'Cerrar sesión / Cambiar de usuario' }).click();
      await expect(page.getByRole('heading', { level: 1, name: '¿Quién eres?' })).toBeVisible();
      await page.getByRole('button', { name: /Carlos/ }).click();
      await pin(page, '5678');

      // Más (cajero): sin Contabilidad ni Usuarios; con su cuenta
      await irAMas(page);
      const delCajero = page.getByRole('list', { name: 'Otras secciones' });
      await expect(delCajero.getByRole('link', { name: /Caja/ }).first()).toBeVisible();
      await expect(delCajero.getByRole('link', { name: /Mi cuenta/ })).toBeVisible();
      await expect(delCajero.getByRole('link', { name: /Contabilidad/ })).toHaveCount(0);
      await expect(delCajero.getByRole('link', { name: /^Usuarios/ })).toHaveCount(0);
      await captura('mas-cajero');

      // Tarjetas tocables de al menos 48 px y sin desborde lateral
      const altos = await delCajero.locator('.mas__tarjeta').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
      for (const alto of altos) expect(alto).toBeGreaterThanOrEqual(48);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      // Aunque escriba la ruta, la contabilidad no se le muestra
      await page.evaluate(() => (location.hash = '#/contabilidad'));
      await expect(page.getByText('Esta sección es del dueño.')).toBeVisible();
    });
  });
}
