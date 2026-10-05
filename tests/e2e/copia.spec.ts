import { expect, test } from '@playwright/test';

test('copia ZIP: exportar, borrar la nota, importar y vuelve igual (historia 7)', async ({ page }) => {
  await page.goto('/#/notas');
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByRole('button', { name: 'En blanco' }).click();
  await page.getByLabel('Título').fill('Apuntes de francés');
  await page.getByLabel('Contenido').fill('Subjuntivo @2026-10-12 #idiomas con ñ');
  await page.waitForTimeout(900);
  await expect(page.getByRole('status')).toHaveText('Guardado');

  // Exportar desde Ajustes: el navegador lo descarga
  await page.goto('/#/ajustes');
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar notas (ZIP)' }).click();
  const zip = await descarga;
  expect(zip.suggestedFilename()).toMatch(/^marginalia-\d{4}-\d\d-\d\d\.zip$/);
  const ruta = test.info().outputPath('copia.zip');
  await zip.saveAs(ruta);
  await expect(page.getByText(/1 nota exportada sin cifrar/)).toBeVisible();

  // Borrar la nota
  await page.goto('/#/notas');
  await page.getByRole('link', { name: 'Apuntes de francés' }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Borrar nota' }).click();
  await expect(page.getByText('Aún no hay notas.')).toBeVisible();

  // Importar el ZIP
  await page.goto('/#/ajustes');
  const selector = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar notas (ZIP)' }).click();
  await (await selector).setFiles(ruta);
  await expect(page.getByText('1 nota importada.')).toBeVisible();

  await page.goto('/#/notas');
  await page.getByRole('link', { name: 'Apuntes de francés' }).click();
  await expect(page.locator('.lectura')).toContainText('Subjuntivo');
  await expect(page.locator('.lectura .enlace-fecha')).toHaveText('@2026-10-12');

  // Importar otra vez la misma copia no duplica nada
  await page.goto('/#/ajustes');
  const otra = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar notas (ZIP)' }).click();
  await (await otra).setFiles(ruta);
  await expect(page.getByText('0 notas importadas · 1 ya estaba.')).toBeVisible();
});
