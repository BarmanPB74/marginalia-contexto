import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/galeria');
  await page.evaluate(() => document.fonts.ready);
  // Medir con las animaciones de entrada ya terminadas (escalan un poco al aparecer)
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)),
  );
});

test('la galería muestra todos los componentes base', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Galería' })).toBeVisible();
  for (const nombre of ['Disposicion', 'Cifra', 'Paleta', 'Tipografía', 'Icono', 'Boton', 'Chip', 'Tarjeta', 'CampoTexto', 'CampoNumero', 'Casilla', 'Rango', 'Tabla', 'TecladoNumerico', 'TecladoPin', 'Dialogo', 'CeldaDia']) {
    await expect(page.getByRole('heading', { level: 2, name: nombre, exact: true })).toBeVisible();
  }
});

test('todo lo tocable mide al menos 44 × 44 px (48 es la meta, DISENO.md)', async ({ page }) => {
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll('button, input')]
      // Área real de toque: una casilla se toca por toda su etiqueta; el nombre de una tarjeta
      // de producto se estira a toda la tarjeta (::after); un rango, por su pista de 48 px.
      .map((el) => {
        const area = el.closest('label, .tarjeta-producto, .rango__pistas') ?? el;
        return { texto: el.textContent?.trim() || el.getAttribute('aria-label') || el.tagName, caja: area.getBoundingClientRect() };
      })
      .filter(({ caja }) => caja.width > 0 && (caja.width < 44 || caja.height < 44))
      .map(({ texto, caja }) => `${texto}: ${Math.round(caja.width)}×${Math.round(caja.height)}`),
  );
  expect(pequenos).toEqual([]);
});

test('no hay scroll horizontal a 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde).toBe(0);
});

test('el interruptor cambia al tocarlo y "Volver" lleva a la app (primer uso: crear dueño)', async ({ page }) => {
  const interruptor = page.getByRole('switch', { name: 'Ejemplo apagado' });
  await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  await interruptor.click();
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bienvenido' })).toBeVisible();
});
