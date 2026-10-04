import { expect, test } from '@playwright/test';

test('la pantalla de papel muestra el nombre', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Marginalia' })).toBeVisible();
});

test('las fuentes locales cargan bajo la CSP y el título usa la letra a mano', async ({ page }) => {
  const peticionesExternas: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) peticionesExternas.push(r.url());
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const cargadas = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/['"]/g, '')),
  );
  expect(cargadas).toEqual(expect.arrayContaining(['Newsreader', 'Kalam']));
  const letraTitulo = await page.getByRole('heading', { name: 'Marginalia' }).evaluate((h) => getComputedStyle(h).fontFamily);
  expect(letraTitulo).toMatch(/^"?Kalam/);
  expect(peticionesExternas).toEqual([]);
});
