import { expect, test } from '@playwright/test';

const dos = (n: number) => String(n).padStart(2, '0');
const dia = (f: Date) => `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;

async function notaNueva(page: import('@playwright/test').Page, titulo: string, cuerpo: string) {
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByRole('button', { name: 'En blanco' }).click();
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Contenido').fill(cuerpo);
  await page.waitForTimeout(900);
}

test('autocompletar: @ sugiere fechas en palabras y # las etiquetas que ya existen', async ({ page }) => {
  await page.goto('/#/notas');
  await notaNueva(page, 'Primera', 'Repaso de #francés');
  await page.goto('/#/notas');
  await notaNueva(page, 'Segunda', '');

  const editor = page.getByLabel('Contenido');
  await editor.click();
  await page.keyboard.type('Entrega @mañ');
  const lista = page.locator('.cm-tooltip-autocomplete');
  await expect(lista).toBeVisible();
  await expect(lista.getByRole('option').first()).toContainText('mañana');
  await page.keyboard.press('Enter');
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  await expect(editor).toContainText(`Entrega @${dia(manana)} `);

  await page.keyboard.type('y #fr');
  await expect(lista.getByRole('option').first()).toHaveText('#francés');
  await page.keyboard.press('Enter');
  await expect(editor).toContainText('y #francés ');
});

test('selector de fecha: «@ Fecha» en la barra abre el mes y pone el día tocado', async ({ page }) => {
  await page.goto('/#/notas');
  await notaNueva(page, 'Con fecha', 'Examen ');
  const editor = page.getByLabel('Contenido');
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.getByRole('button', { name: '@ Fecha' }).click();
  const hoja = page.getByRole('dialog', { name: 'Elegir fecha' });
  await expect(hoja).toBeVisible();
  await hoja.getByRole('button', { name: 'Mes siguiente' }).click();
  await hoja.locator('.celda-dia:not(.celda-dia--fuera)').filter({ hasText: /^15$/ }).click();
  await expect(hoja).toHaveCount(0);
  const hoy = new Date();
  const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 15);
  await expect(editor).toContainText(`Examen @${dia(siguiente)}`);
});
