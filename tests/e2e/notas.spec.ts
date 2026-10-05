import { expect, test, type Page } from '@playwright/test';

async function nuevaNota(page: Page, plantilla: string) {
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByRole('button', { name: plantilla }).click();
  await expect(page.getByLabel('Contenido')).toBeVisible();
}

test('crear desde plantilla, escribir y recargar: todo se conserva', async ({ page }) => {
  await page.goto('/#/notas');
  await expect(page.getByText('Aún no hay notas.')).toBeVisible();

  await nuevaNota(page, 'Reunión');
  await expect(page.getByLabel('Título')).toHaveValue(/^Reunión \d{4}-\d\d-\d\d$/);
  await expect(page.getByLabel('Contenido')).toHaveValue(/## Acuerdos/);

  await page.getByLabel('Título').fill('Reunión de prueba');
  await page.getByLabel('Contenido').fill('# Acta\n\nTexto con **Markdown** y ñ.');
  await expect(page.getByRole('status')).toHaveText('Guardado');

  await page.reload();
  await expect(page.getByLabel('Título')).toHaveValue('Reunión de prueba');
  await expect(page.getByLabel('Contenido')).toHaveValue('# Acta\n\nTexto con **Markdown** y ñ.');

  await page.getByRole('navigation', { name: 'Ubicación' }).getByRole('link', { name: 'Notas' }).click();
  await expect(page.getByRole('link', { name: 'Reunión de prueba' })).toBeVisible();
});

test('subpáginas: se crean dentro, salen con sangría y atrás vuelve a la madre', async ({ page }) => {
  await page.goto('/#/notas');
  await nuevaNota(page, 'En blanco');
  await page.getByLabel('Título').fill('Francés');
  await expect(page.getByRole('status')).toHaveText('Guardado');

  await page.getByRole('button', { name: 'Subpágina' }).click();
  await page.getByRole('button', { name: 'En blanco' }).click();
  await expect(page.getByRole('navigation', { name: 'Ubicación' }).getByRole('link', { name: 'Francés' })).toBeVisible();
  await page.getByLabel('Título').fill('Subjuntivo');
  await expect(page.getByRole('status')).toHaveText('Guardado');

  await page.goBack();
  await expect(page.getByLabel('Título')).toHaveValue('Francés');

  await page.goto('/#/notas');
  const madre = page.getByRole('link', { name: 'Francés' });
  const hija = page.getByRole('link', { name: 'Subjuntivo' });
  const [xMadre, xHija] = [(await madre.boundingBox())?.x ?? 0, (await hija.boundingBox())?.x ?? 0];
  expect(xHija).toBeGreaterThan(xMadre);
  // filas táctiles de al menos 48 px y sin scroll horizontal
  expect((await hija.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('borrar una nota (confirmado) la quita de la lista', async ({ page }) => {
  await page.goto('/#/notas');
  await nuevaNota(page, 'Nota rápida');
  await page.getByLabel('Título').fill('Para borrar');
  await expect(page.getByRole('status')).toHaveText('Guardado');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Borrar nota' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Para borrar' })).toHaveCount(0);
});
