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

test('flotante: lanzado contra un lado se esconde en una pestaña, y vuelve con un toque', async ({ page }) => {
  await activarFlotante(page);
  const a = await page.getByRole('button', { name: 'Mover reproductor' }).boundingBox();
  const vista = page.viewportSize();
  if (!a || !vista) throw new Error('sin cajas');
  await page.mouse.move(a.x + 10, a.y + 10);
  await page.mouse.down();
  await page.mouse.move(vista.width - 2, a.y - 100, { steps: 8 });
  await page.mouse.up();
  await expect(mini(page)).toHaveCount(0);
  const pestana = page.getByRole('button', { name: /Mostrar reproductor/ });
  // Entra deslizándose desde el borde: al terminar queda pegada al canto derecho
  await expect.poll(async () => {
    const p = await pestana.boundingBox();
    return p ? Math.round(p.x + p.width) : null;
  }).toBe(vista.width);
  await pestana.click();
  await expect(mini(page)).toBeVisible();
});

test('flotante: aunque se lance fuera por arriba o abajo, no sale de la pantalla ni tapa la barra', async ({ page }) => {
  await activarFlotante(page);
  const a = await page.getByRole('button', { name: 'Mover reproductor' }).boundingBox();
  if (!a) throw new Error('sin asa');
  const vista = page.viewportSize();
  if (!vista) throw new Error('sin viewport');
  for (const [x, y] of [
    [vista.width / 2, -500],
    [vista.width / 2, vista.height + 500],
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

test('el mini: todo lo tocable mide ≥ 48 px y «Reproducir» lleva a Música', async ({ page }) => {
  await activarFlotante(page);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const cajas = await mini(page).locator('button, a').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()).map((c) => [c.width, c.height]),
  );
  for (const [ancho, alto] of cajas) {
    expect(ancho).toBeGreaterThanOrEqual(48);
    expect(alto).toBeGreaterThanOrEqual(48);
  }
  await mini(page).getByRole('button', { name: 'Reproducir' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Música' })).toBeVisible();
  await expect(mini(page)).toHaveCount(0);
});

test('las líneas de progreso y volumen se ven: tienen alto y casi todo el ancho', async ({ page }) => {
  await page.goto('/#/galeria');
  const grande = page.getByRole('region', { name: 'Reproductor', exact: true }).first();
  const r = await grande.boundingBox();
  if (!r) throw new Error('sin caja');
  for (const nombre of ['Progreso', 'Volumen']) {
    const caja = await grande.getByRole('progressbar', { name: nombre }).boundingBox();
    if (!caja) throw new Error(`sin caja: ${nombre}`);
    expect(caja.height, nombre).toBeGreaterThanOrEqual(1);
    expect(caja.width, nombre).toBeGreaterThan(r.width * 0.5);
  }
});

test('pegar un enlace de YouTube Music: título por oEmbed, reproductor oficial y queda guardada', async ({ page }) => {
  // Sin depender de la red: oEmbed responde lo de siempre y el reproductor no se descarga
  await page.route('https://www.youtube.com/oembed**', (r) =>
    r.fulfill({ json: { title: 'Tema de prueba', author_name: 'Artista - Topic' }, headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  await page.route('https://i.ytimg.com/**', (r) => r.abort());
  await page.goto('/#/musica');
  await page.getByLabel('Enlace de YouTube Music').fill('https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x');
  await page.getByRole('button', { name: 'Añadir' }).click();
  const grande = page.getByRole('region', { name: 'Reproductor', exact: true });
  await expect(grande.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  await expect(grande.getByText('Tema de prueba')).toBeVisible();
  await expect(grande.getByText('Artista', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Canciones guardadas' }).getByText('Tema de prueba')).toBeVisible();

  // Política de YouTube: visor de al menos 200 × 200 px, también en un teléfono estrecho
  for (const ancho of [412, 320]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    // medir sin la animación de entrada (escala 0.96 → 1)
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const caja = await grande.locator('iframe').boundingBox();
    expect(caja?.width, `ancho a ${ancho}px`).toBeGreaterThanOrEqual(200);
    expect(caja?.height, `alto a ${ancho}px`).toBeGreaterThanOrEqual(200);
  }

  await page.reload();
  await page.goto('/#/notas');
  await expect(mini(page).getByText('Tema de prueba')).toBeVisible();
});
