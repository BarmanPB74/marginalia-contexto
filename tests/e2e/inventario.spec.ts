import { expect, test, type Page } from '@playwright/test';

/**
 * Inventario de punta a punta: primer uso → importar el .xls (tabla HTML inventada) → filtrar →
 * contar → registrar una factura con foto → aplicarla. En teléfono y en tableta horizontal.
 * Capturas en capturas/inventario/ (carpeta ignorada por git).
 */
const TAMANOS = [
  { nombre: 'telefono', width: 360, height: 800 },
  { nombre: 'tableta', width: 1280, height: 800 },
] as const;

const TABLA = 'tests/unit/fixtures/inventario-tabla.xls';
const FOTO = 'tests/e2e/fixtures/factura-inventada.png';

async function pin(page: Page, digitos: string) {
  for (const d of digitos) await page.getByRole('button', { name: d, exact: true }).click();
}

/** Cambia de pantalla sin recargar (recargar cerraría la sesión). */
async function irA(page: Page, hash: string) {
  await page.evaluate((h) => (location.hash = h), hash);
}

const desbordeHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const t of TAMANOS) {
  test.describe(`inventario en ${t.width}×${t.height}`, () => {
    test.use({ viewport: { width: t.width, height: t.height } });

    test('primer uso → importar → filtrar → contar → factura con foto → aplicar', async ({ page }) => {
      const captura = async (nombre: string) => {
        expect(await desbordeHorizontal(page), `scroll horizontal en ${nombre}`).toBeLessThanOrEqual(0);
        // Con una hoja abierta, solo lo visible: la captura de página completa cambia el tamaño
        // de la ventana un instante y, en pantalla dividida, la ficha se vuelve a montar.
        const conHoja = (await page.getByRole('dialog').count()) > 0;
        await page.screenshot({ path: `capturas/inventario/${nombre}-${t.nombre}.png`, fullPage: !conHoja });
      };
      const compacto = t.width < 840;
      await page.goto('/');

      // Primer uso
      await expect(page.getByRole('heading', { level: 1, name: 'Bienvenido' })).toBeVisible();
      await page.getByLabel('Tu nombre').fill('Dueña');
      await page.getByRole('button', { name: 'Seguir' }).click();
      await pin(page, '1234');
      await pin(page, '1234');

      // Inventario vacío
      await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Inventario' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible();
      await expect(page.getByText('Aún no hay productos.')).toBeVisible();
      await captura('1-vacio');

      // Importar el .xls que en realidad es una tabla HTML
      await page.getByRole('button', { name: 'Importar (Excel o CSV)' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Importar inventario' })).toBeVisible();
      await page.locator('input[aria-label="Elegir archivo de inventario"]').setInputFiles(TABLA);
      await expect(page.getByRole('heading', { level: 1, name: 'Revisar importación' })).toBeVisible();
      await expect(page.getByLabel('Cantidad (existencia final)')).toHaveValue('3');
      await expect(page.getByText(/coma decimal/)).toBeVisible();
      await expect(page.getByRole('region', { name: 'Resumen de la vista previa' }).getByText('8', { exact: true })).toBeVisible();
      await captura('2-importar-previa');
      await page.getByRole('button', { name: 'Confirmar importación' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Inventario importado' })).toBeVisible();
      await expect(page.getByText('inventario-tabla.xls')).toHaveCount(0);
      await captura('3-importar-resumen');
      await page.getByRole('button', { name: 'Ver inventario' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible();
      await expect(page.getByText(/con existencias negativas/)).toBeVisible();
      await captura('4-inventario');

      // Filtrar por «Negativo»: panel lateral en tableta, hoja «Filtros» en teléfono
      if (compacto) {
        await page.getByRole('button', { name: 'Filtros', exact: true }).click();
        const hoja = page.getByRole('dialog', { name: 'Filtros' });
        await hoja.getByRole('button', { name: /^Negativo/ }).click();
        await captura('5-filtros-hoja');
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Filtros (1)' })).toBeVisible();
      } else {
        await page.getByRole('complementary', { name: 'Filtros' }).getByRole('button', { name: /^Negativo/ }).click();
      }
      await expect(page.getByRole('button', { name: 'Quitar filtro: Negativo' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Productos' }).getByRole('button', { name: 'CAFÉ OSCURO' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Productos' }).getByRole('button', { name: 'AGUA CON GAS' })).toHaveCount(0);
      await captura('6-filtrado');

      // Contar CAFÉ OSCURO: había -2, hay 6
      await page.getByRole('button', { name: 'CAFÉ OSCURO' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'CAFÉ OSCURO' })).toBeVisible();
      await page.getByRole('button', { name: 'Contar', exact: true }).click();
      const contar = page.getByRole('dialog', { name: 'Contar CAFÉ OSCURO' });
      await contar.getByLabel('¿Cuántas hay?').fill('6');
      await expect(contar.getByText('+8 und')).toBeVisible();
      await captura('7-contar');
      await contar.getByRole('button', { name: 'Guardar conteo' }).click();
      await expect(page.getByRole('region', { name: 'Cifras del producto' }).getByText('6 und', { exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Conteo' })).toBeVisible();
      await captura('8-ficha');

      // Factura de compra con foto
      await irA(page, '#/compras');
      await expect(page.getByRole('heading', { level: 1, name: 'Compras y facturas' })).toBeVisible();
      await page.getByRole('button', { name: 'Nueva factura' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Nueva factura' })).toBeVisible();
      await page.getByLabel('Proveedor').fill('Distribuidora Inventada');
      await page.getByLabel('Número de factura').fill('FV-1');
      await page.getByRole('searchbox', { name: 'Agregar producto a la factura' }).fill('agua');
      await page.getByRole('list', { name: 'Productos encontrados' }).getByRole('button', { name: /AGUA CON GAS/ }).click();
      await page.getByLabel('Cantidad de AGUA CON GAS').fill('12');
      await page.getByLabel('Costo unitario').fill('1.500');
      await expect(page.locator('.inv-total')).toContainText('$ 18.000');
      await page.locator('input[aria-label="Elegir foto o PDF"]').setInputFiles(FOTO);
      await expect(page.getByText('factura-inventada.png')).toBeVisible();
      await captura('9-factura-nueva');
      await page.getByRole('button', { name: 'Registrar factura' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Factura FV-1' })).toBeVisible();
      // La foto se descifra y se ve con una URL blob: (permitida por la CSP)
      const foto = page.locator('img.adjuntos__imagen');
      await expect(foto).toBeVisible();
      await expect(foto).toHaveAttribute('src', /^blob:/);
      expect(await foto.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

      // Aplicar una sola vez
      await page.getByRole('button', { name: 'Aplicar al inventario' }).click();
      await page.getByRole('alertdialog', { name: '¿Aplicar al inventario?' }).getByRole('button', { name: 'Aplicar' }).click();
      await expect(page.getByText('Aplicada', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aplicar al inventario' })).toHaveCount(0);
      await captura('10-factura-aplicada');

      // Las existencias subieron: 23 + 12
      await irA(page, '#/inventario');
      await page.getByRole('searchbox', { name: 'Buscar productos' }).fill('agua con gas');
      await expect(page.getByRole('region', { name: 'Productos' }).getByText('35 und')).toBeVisible();
    });
  });
}
