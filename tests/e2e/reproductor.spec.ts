import { expect, test, type Page } from '@playwright/test';

const mini = (page: Page) => page.getByRole('region', { name: 'Reproductor pequeño' });
const barra = (page: Page) => page.getByRole('navigation', { name: 'Secciones' });

async function activarFlotante(page: Page) {
  await page.goto('/#/ajustes');
  await page.getByRole('switch', { name: /Reproductor flotante/ }).click();
  await expect(mini(page)).toHaveClass(/mini--flotante/);
}

test('anclado: el mini queda encima de la barra, sin taparla, y la página le deja sitio', async ({ page }) => {
  await page.goto('/#/notas');
  const m = await mini(page).boundingBox();
  const b = await barra(page).boundingBox();
  if (!m || !b) throw new Error('sin cajas');
  expect(m.y + m.height).toBeLessThanOrEqual(b.y);
  const reserva = await page.locator('main').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(reserva).toBeGreaterThanOrEqual(b.height + m.height);
});

test('flotante: se arrastra por el asa y se queda donde se suelta', async ({ page }) => {
  await activarFlotante(page);
  const asa = page.getByRole('button', { name: 'Mover reproductor' });
  const antes = await mini(page).boundingBox();
  const a = await asa.boundingBox();
  if (!antes || !a) throw new Error('sin cajas');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 - 40, a.y + a.height / 2 - 300, { steps: 8 });
  await page.mouse.up();
  const despues = await mini(page).boundingBox();
  expect(despues?.x).toBeCloseTo(antes.x - 40, 0);
  expect(despues?.y).toBeCloseTo(antes.y - 300, 0);
});

test('flotante: aunque se lance fuera, no sale de la pantalla ni tapa la barra', async ({ page }) => {
  await activarFlotante(page);
  const a = await page.getByRole('button', { name: 'Mover reproductor' }).boundingBox();
  if (!a) throw new Error('sin asa');
  const vista = page.viewportSize();
  if (!vista) throw new Error('sin viewport');
  for (const [x, y] of [
    [-500, -500],
    [vista.width + 500, vista.height + 500],
  ] as const) {
    const actual = await page.getByRole('button', { name: 'Mover reproductor' }).boundingBox();
    if (!actual) throw new Error('sin asa');
    await page.mouse.move(actual.x + 10, actual.y + 10);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 5 });
    await page.mouse.up();
    const m = await mini(page).boundingBox();
    const b = await barra(page).boundingBox();
    if (!m || !b) throw new Error('sin cajas');
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.y).toBeGreaterThanOrEqual(0);
    expect(m.x + m.width).toBeLessThanOrEqual(vista.width);
    expect(m.y + m.height).toBeLessThanOrEqual(b.y);
  }
});

test('el mini y el grande comparten estado, y todo lo tocable mide ≥ 48 px', async ({ page }) => {
  await activarFlotante(page);
  await mini(page).getByRole('button', { name: 'Reproducir' }).click();
  await expect(mini(page).getByRole('button', { name: 'Pausar' })).toBeVisible();
  const cajas = await mini(page).locator('button, a').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()).map((c) => [c.width, c.height]),
  );
  for (const [ancho, alto] of cajas) {
    expect(ancho).toBeGreaterThanOrEqual(48);
    expect(alto).toBeGreaterThanOrEqual(48);
  }
  await mini(page).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Música' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reproductor', exact: true }).getByRole('button', { name: 'Pausar' })).toBeVisible();
  await expect(mini(page)).toHaveCount(0);
});
