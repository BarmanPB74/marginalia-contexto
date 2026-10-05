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
  await expect(page.getByLabel('Contenido')).toContainText('## Acuerdos');

  await page.getByLabel('Título').fill('Reunión de prueba');
  await page.getByLabel('Contenido').fill('# Acta\n\nTexto con **Markdown** y ñ.');
  // CodeMirror procesa lo escrito un instante después: se espera más que la pausa de autoguardado (600 ms)
  await page.waitForTimeout(900);
  await expect(page.getByRole('status')).toHaveText('Guardado');

  await page.reload();
  await expect(page.getByLabel('Título')).toHaveValue('Reunión de prueba');
  // Ya editada: abre en lectura, con el Markdown pintado
  await expect(page.locator('.lectura h1')).toHaveText('Acta');
  await expect(page.locator('.lectura strong')).toHaveText('Markdown');
  await expect(page.locator('.lectura')).toContainText('y ñ.');
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByLabel('Contenido')).toContainText('Texto con **Markdown** y ñ.');

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

  // La sangría es de la vista de lista (la app abre en tarjetas)
  await page.goto('/#/notas');
  await page.getByRole('button', { name: 'Ver como lista' }).click();
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

test('mientras se escribe: barra de formato sobre el teclado, sin barra de secciones', async ({ page }) => {
  await page.goto('/#/notas');
  await nuevaNota(page, 'En blanco');
  await page.getByLabel('Contenido').click();
  const formato = page.getByRole('toolbar', { name: 'Formato' });
  await expect(formato).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeHidden();
  await page.keyboard.type('comprar pan');
  await formato.getByRole('button', { name: 'Tarea' }).click();
  await formato.getByRole('button', { name: 'Negrita' }).click();
  await page.keyboard.type('ya');
  await expect(page.getByLabel('Contenido')).toHaveText('- [ ] comprar pan**ya**');
  // cada botón de la barra mide al menos 48 px
  for (const caja of await formato.getByRole('button').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height))) {
    expect(caja).toBeGreaterThanOrEqual(48);
  }
  await page.getByRole('button', { name: 'Leer' }).click();
  await expect(formato).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
  await expect(page.locator('.lectura input[type="checkbox"]')).toHaveCount(1);
});

test('XSS: lo escrito en una nota nunca se ejecuta en modo lectura', async ({ page }) => {
  const dialogos: string[] = [];
  page.on('dialog', (d) => {
    dialogos.push(d.message());
    void d.dismiss();
  });
  await page.goto('/#/notas');
  await nuevaNota(page, 'En blanco');
  await page.getByLabel('Contenido').fill(
    '<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>\n\n[clic](javascript:alert(3))\n\n<svg onload=alert(4)>',
  );
  await page.getByRole('button', { name: 'Leer' }).click();
  await expect(page.locator('.lectura')).toContainText('<script>alert(2)</script>');
  await page.locator('.lectura').getByText('clic').click();
  await page.waitForTimeout(300);
  expect(dialogos).toEqual([]);
  expect(await page.locator('.lectura img, .lectura script, .lectura svg, .lectura [onerror], .lectura [onload]').count()).toBe(0);
  expect(await page.locator('.lectura a[href^="javascript"]').count()).toBe(0);
});
