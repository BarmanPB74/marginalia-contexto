import { expect, test } from '@playwright/test';
import { entrar } from './sesion';

test('la app abre en Inicio y la navegación lleva a cada sección', async ({ page }) => {
  await entrar(page, '/');
  await expect(page.getByRole('heading', { level: 1, name: /Hola, Pablo/ })).toBeVisible();
  const barra = page.getByRole('navigation', { name: 'Secciones' });
  for (const [enlace, titulo] of [
    ['Vender', 'Vender'],
    ['Inventario', 'Inventario'],
    ['Mesas', 'Mesas'],
    ['Más', 'Más'],
  ] as const) {
    await barra.getByRole('link', { name: enlace }).click();
    await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
    await expect(barra.getByRole('link', { name: enlace })).toHaveAttribute('aria-current', 'page');
  }
});

test('el botón atrás de Android (historial) vuelve a la sección anterior', async ({ page }) => {
  await entrar(page, '/#/notas');
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Inventario' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Notas' })).toBeVisible();
});

test('la barra no tapa el contenido y sus enlaces miden al menos 48 px', async ({ page }) => {
  await entrar(page, '/#/inicio');
  const cajas = await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link').evaluateAll((as) =>
    as.map((a) => a.getBoundingClientRect()).map((c) => [c.width, c.height]),
  );
  for (const [ancho, alto] of cajas) {
    expect(ancho).toBeGreaterThanOrEqual(48);
    expect(alto).toBeGreaterThanOrEqual(48);
  }
  const reserva = await page.locator('main').evaluate((m) => parseFloat(getComputedStyle(m).paddingBottom));
  const barra = await page.getByRole('navigation', { name: 'Secciones' }).boundingBox();
  expect(reserva).toBeGreaterThanOrEqual(barra?.height ?? Infinity);
});

test('sin red: las fuentes son locales y no sale ninguna petición fuera de la app', async ({ page }) => {
  const peticionesExternas: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) peticionesExternas.push(r.url());
  });
  await entrar(page, '/');
  await page.evaluate(() => document.fonts.ready);
  const cargadas = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/['"]/g, '')),
  );
  expect(cargadas.some((f) => f.startsWith('Inter'))).toBe(true);
  expect(peticionesExternas).toEqual([]);
});
