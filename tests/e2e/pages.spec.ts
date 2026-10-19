import { levelZip } from '../helpers/package.ts';
import { required } from '../helpers/required.ts';
import { test, expect } from '@playwright/test';
import { start, editor, editorSnapshot } from './helpers.ts';
test('separate pages, legacy URLs, session reload and expired sessions', async ({
  page,
}) => {
  await page.goto('/#/editor');
  await expect(page).toHaveURL(/\/editor.html$/);
  await page.waitForFunction(() => window.__app?.route === 'editor');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page).toHaveURL(/\/index.html$/);
  await start(page);
  const url = page.url();
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.waitForFunction(() => !!window.__game);
  expect(page.url()).toBe(url);
  await page.goto('/game.html?session=expired');
  await expect(page.getByRole('alert')).toContainText('expired');
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toBeVisible();
  await page.goto('/#/play');
  await expect(page).toHaveURL(/\/game.html$/);
  await page.waitForFunction(() => !!window.__game);
});
test('blocked storage reports an error on Menu without navigating', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error('blocked');
    };
  });
  await page.goto('/');
  const { source } = await import('../helpers/level.ts');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'map.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(source),
  });
  await expect(page.getByRole('status')).toContainText(
    'storage is unavailable',
  );
  await expect(page.locator('.menu')).toBeVisible();
});
test('Inspect requires a click, keeps its cell anchor across scopes, and guards tool changes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await editor(page);
  const canvas = page.locator('#editor-canvas'),
    box = await canvas.boundingBox(),
    panel = page.getByRole('complementary', { name: 'Tile inspector' });
  await page.locator('[data-tile="4"]').click();
  await expect(panel).toBeHidden();
  await page.mouse.click(required(box).x + 80, required(box).y + 80);
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.move(required(box).x + 80, required(box).y + 80);
  await expect(panel).toBeHidden();
  await page.mouse.click(required(box).x + 80, required(box).y + 80);
  await expect(panel).toBeVisible();
  const before = await panel.boundingBox();
  await panel.getByLabel('Property scope').selectOption('type');
  const after = await panel.boundingBox();
  expect(required(after).x).toBeCloseTo(required(before).x, 0);
  expect(required(after).y).toBeCloseTo(required(before).y, 0);
  await panel.getByLabel('Friction multiplier', { exact: true }).fill('0');
  await page.locator('[data-tool="brush"]').click();
  await expect(page.locator('.decision')).toBeVisible();
  await page
    .locator('.decision')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  expect((await editorSnapshot(page)).tool).toBe('inspect');
  await expect(panel).toBeVisible();
  await page.locator('[data-tool="brush"]').click();
  await page
    .locator('.decision')
    .getByRole('button', { name: 'Discard', exact: true })
    .click();
  await expect(panel).toBeHidden();
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.click(required(box).x + 80, required(box).y + 80);
  await expect(panel).toBeVisible();
  await page.mouse.click(
    required(box).x + required(box).width - 32,
    required(box).y + 32,
  );
  await expect(panel).toBeHidden();
  page.on('dialog', (d) => d.accept());
});
test('Menu loads only background PNGs and reduced motion still scrolls its backdrop', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pngs: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.png')) pngs.push(r.url());
  });
  await page.goto('/');
  await expect.poll(() => pngs.length).toBe(1);
  await page.waitForFunction(
    () =>
      performance
        .getEntriesByType('resource')
        .filter((e) => e.name.endsWith('.png')).length === 1,
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#menu-background');
    return (
      canvas instanceof HTMLCanvasElement &&
      canvas.getContext('2d')?.getImageData(0, 0, 1, 1).data[3] === 255
    );
  });
  const checksum = () =>
    page.locator('#menu-background').evaluate(async (canvas) => {
      if (!(canvas instanceof HTMLCanvasElement))
        throw new Error('Expected canvas');
      const bytes = new TextEncoder().encode(canvas.toDataURL());
      return Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      )
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
    });
  const image = await checksum();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect.poll(checksum).not.toBe(image);
  expect(pngs.every((p) => /background-night-atlas\.png$/.test(p))).toBe(true);
});
test('map loading errors use HTML overlays and arbitrary built-in names are rejected', async ({
  page,
}) => {
  await page.route('**/maps/forest-ruins.json', (r) =>
    r.fulfill({ status: 500, body: 'broken' }),
  );
  await page.goto('/game.html');
  await expect(page.getByRole('alert')).toContainText('Could not load map');
  await page.goto('/game.html?map=https://example.com/map.json');
  await expect(page.getByRole('alert')).toContainText('Unknown built-in');
});
