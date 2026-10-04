import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/galeria');
  await page.evaluate(() => document.fonts.ready);
});

test('la galería muestra todos los componentes base', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Galería' })).toBeVisible();
  for (const nombre of ['Tipografía', 'Icono', 'Boton', 'Etiqueta', 'Tarjeta', 'CampoTexto', 'Interruptor', 'CeldaDia']) {
    await expect(page.getByRole('heading', { level: 2, name: nombre })).toBeVisible();
  }
});

test('todo lo tocable mide al menos 48 × 48 px', async ({ page }) => {
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll('button, input')]
      .map((el) => ({ texto: el.textContent?.trim() || el.getAttribute('aria-label') || el.tagName, caja: el.getBoundingClientRect() }))
      .filter(({ caja }) => caja.width < 48 || caja.height < 48)
      .map(({ texto, caja }) => `${texto}: ${Math.round(caja.width)}×${Math.round(caja.height)}`),
  );
  expect(pequenos).toEqual([]);
});

test('no hay scroll horizontal a 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde).toBe(0);
});

test('el interruptor cambia al tocarlo y "Volver" lleva a Notas', async ({ page }) => {
  const interruptor = page.getByRole('switch', { name: 'Ejemplo apagado' });
  await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  await interruptor.click();
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
});
