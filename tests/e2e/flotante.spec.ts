import { expect, test, type Page } from '@playwright/test';

/** Lo que exige YouTube (LEGAL §1): visor ≥ 200 × 200 y NADA delante de ningún punto del video. */
async function comprobarVisor(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  const marco = page.locator('iframe[title="Reproductor de YouTube"]');
  const caja = await marco.boundingBox();
  if (!caja) throw new Error('sin reproductor');
  expect(caja.width).toBeGreaterThanOrEqual(200);
  expect(caja.height).toBeGreaterThanOrEqual(200);
  const tapados = await marco.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const fuera: string[] = [];
    for (const fx of [0.02, 0.25, 0.5, 0.75, 0.98]) {
      for (const fy of [0.02, 0.25, 0.5, 0.75, 0.98]) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const arriba = document.elementFromPoint(x, y);
        if (arriba !== el) fuera.push(`${fx},${fy}: ${arriba?.className ?? arriba?.tagName}`);
      }
    }
    return fuera;
  });
  expect(tapados).toEqual([]);
}

test('opción B: el video sigue flotando fuera de Música, siempre visible y sin nada delante', async ({ page }) => {
  await page.route('https://www.youtube.com/oembed**', (r) =>
    r.fulfill({ json: { title: 'Tema de prueba', author_name: 'Artista' }, headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  await page.route('https://i.ytimg.com/**', (r) => r.abort());
  await page.goto('/#/musica');
  await page.getByLabel('Enlace de YouTube Music').fill('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.locator('.capa-video--musica')).toBeVisible();
  await comprobarVisor(page);

  // Sale de Música sonando → ventana flotante con el mismo reproductor
  const marco = await page.locator('iframe').elementHandle();
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Notas' }).click();
  await expect(page.locator('.capa-video--flotante')).toBeVisible();
  expect(await page.locator('iframe').evaluate((el, antes) => el === antes, marco)).toBe(true);
  await comprobarVisor(page);

  // Con la paleta abierta, el video sigue delante de todo
  await page.getByRole('button', { name: 'Buscar y comandos' }).click();
  await comprobarVisor(page);
  await page.keyboard.press('Escape');

  // Arrastrarla por la barra (nunca por el video) y que siga dentro de la pantalla
  const asa = await page.getByRole('button', { name: 'Mover reproductor' }).boundingBox();
  if (!asa) throw new Error('sin asa');
  await page.mouse.move(asa.x + 10, asa.y + 10);
  await page.mouse.down();
  await page.mouse.move(asa.x - 60, asa.y - 250, { steps: 6 });
  await page.mouse.up();
  await comprobarVisor(page);

  // Esconderla la pausa y la quita de la vista; la pestaña la trae
  await page.getByRole('button', { name: 'Esconder reproductor a un lado (se pausa)' }).click();
  await expect(page.locator('.capa-video--escondida')).toHaveCount(1);
  await page.getByRole('button', { name: /Mostrar reproductor/ }).click();
  await comprobarVisor(page);

  // Cerrarla quita el reproductor
  await page.getByRole('button', { name: 'Cerrar reproductor' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
});
