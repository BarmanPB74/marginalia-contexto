import { expect, test } from '@playwright/test';

test('la app abre en Notas y la barra lleva a cada sección', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
  const barra = page.getByRole('navigation', { name: 'Secciones' });
  for (const nombre of ['Calendario', 'Música', 'Ajustes', 'Notas']) {
    await barra.getByRole('link', { name: nombre }).click();
    await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
    await expect(barra.getByRole('link', { name: nombre })).toHaveAttribute('aria-current', 'page');
  }
});

test('el botón atrás de Android (historial) vuelve a la sección anterior', async ({ page }) => {
  await page.goto('/#/notas');
  await page.getByRole('link', { name: 'Calendario' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendario' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
});

test('la barra no tapa el contenido y sus enlaces miden al menos 48 px', async ({ page }) => {
  await page.goto('/#/musica');
  const cajas = await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link').evaluateAll((as) =>
    as.map((a) => a.getBoundingClientRect()).map((c) => [c.width, c.height]),
  );
  for (const [ancho, alto] of cajas) {
    expect(ancho).toBeGreaterThanOrEqual(48);
    expect(alto).toBeGreaterThanOrEqual(48);
  }
  // La página reserva debajo al menos la altura de la barra: así, con contenido largo, lo último nunca queda tapado
  const reserva = await page.locator('main').evaluate((m) => parseFloat(getComputedStyle(m).paddingBottom));
  const barra = await page.getByRole('navigation', { name: 'Secciones' }).boundingBox();
  expect(reserva).toBeGreaterThanOrEqual(barra?.height ?? Infinity);
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
  const letraTitulo = await page.getByRole('heading', { level: 1 }).evaluate((h) => getComputedStyle(h).fontFamily);
  expect(letraTitulo).toMatch(/^"?Kalam/);
  expect(peticionesExternas).toEqual([]);
});
