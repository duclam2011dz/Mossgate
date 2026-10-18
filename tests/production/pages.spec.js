import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
const hooks = () => ({ app: '__app' in window, game: '__game' in window });
test('production pages and imported maps work below a static-hosting subdirectory', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Mossgate' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(hooks)).toEqual({ app: false, game: false });
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-menu.png`,
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-chooser.png`,
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(page).toHaveURL(/\/mossgate\/editor.html$/);
  await expect(page.locator('[data-tile="4"]')).toBeVisible();
  await page.locator('[data-tile="4"]').click();
  await expect(page.locator('.inspector')).toBeHidden();
  await page.locator('#editor-canvas').click({ position: { x: 80, y: 80 } });
  await page.locator('[data-tool="inspect"]').click();
  await page.locator('#editor-canvas').click({ position: { x: 80, y: 80 } });
  await expect(page.locator('.inspector')).toBeVisible();
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-editor.png`,
  });
  await page.getByRole('button', { name: 'Show more...', exact: true }).click();
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-inspector-expanded.png`,
  });
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .locator('.confirmation')
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.locator('.menu')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: readFileSync('public/maps/forest-ruins-legacy.json'),
  });
  await expect(page).toHaveURL(/\/mossgate\/game.html\?session=/);
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(hooks)).toEqual({ app: false, game: false });
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-game.png`,
  });
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(
    await page.locator('#game-canvas').getAttribute('aria-label'),
  ).not.toContain('expired');
  expect(errors).toEqual([]);
  for (const file of readdirSync('dist/assets').filter((n) =>
    n.endsWith('.js'),
  ))
    expect(readFileSync('dist/assets/' + file, 'utf8')).not.toMatch(
      /__game|__app|teleport|snapshot/,
    );
});
test('portrait and HiDPI views keep backing buffers bounded', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
      viewport: { width: 480, height: 900 },
      deviceScaleFactor: 3,
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  await page.goto('http://127.0.0.1:4183/mossgate/');
  await page.waitForLoadState('networkidle');
  expect(
    await page.locator('#menu-background').evaluate((c) => c.height),
  ).toBeLessThanOrEqual(720);
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-portrait-menu.png`,
  });
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(page.locator('[data-tile="4"]')).toBeVisible();
  expect(
    await page.locator('#editor-canvas').evaluate((c) => c.width * c.height),
  ).toBeLessThanOrEqual(480 * 900 * 4);
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-portrait-editor.png`,
  });
  await page.goto('http://127.0.0.1:4183/mossgate/game.html');
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(
    await page.locator('canvas').evaluate((c) => c.height),
  ).toBeLessThanOrEqual(720);
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-portrait-game.png`,
  });
  await context.close();
});
test('maximum editor map stays viewport-sized while panning with the forest background', async ({
  page,
}, info) => {
  await page.goto('editor.html');
  await expect(page.locator('[data-tile="1"]')).toBeVisible();
  await page.getByLabel('Map width').fill('512');
  await page.getByLabel('Map height').fill('128');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByLabel('Zoom', { exact: true }).selectOption('.25');
  await page.locator('[data-tool="fill"]').click();
  await page.locator('#editor-canvas').click({ position: { x: 16, y: 16 } });
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        let last = performance.now();
        const tick = (now) => {
          samples.push(now - last);
          last = now;
          if (samples.length < 100) requestAnimationFrame(tick);
          else resolve(samples.slice(20).sort((a, b) => a - b));
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  const p95 = frames[Math.floor(frames.length * 0.95)];
  info.annotations.push({
    type: 'performance',
    description: `Maximum map pan p95 ${p95.toFixed(1)} ms`,
  });
  console.log(
    `${info.project.name} maximum-map frame p95: ${p95.toFixed(1)} ms`,
  );
  expect(
    await page.locator('#editor-canvas').evaluate((c) => c.width * c.height),
  ).toBeLessThan(1280 * 800 * 4);
  expect(p95).toBeLessThan(150);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  page.on('dialog', (d) => d.accept());
});

test('production glass pause and completion support keyboard and pointer actions', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'short.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 3,
        size: [16, 12],
        spawn: [35, 146],
        portal: [112, 128, 20, 32],
        deathY: 256,
        rects: [[0, 10, 16, 2, 1]],
      }),
    ),
  });
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.keyboard.press('Escape');
  const paused = page.getByRole('dialog', { name: 'Paused' });
  await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-pause.png`,
  });
  await page.keyboard.press('Shift+Tab');
  await expect(paused.getByRole('button', { name: 'Main Menu' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(paused).toBeHidden();
  await page.keyboard.down('d');
  await expect(
    page.getByRole('dialog', { name: 'Gate reached!' }),
  ).toBeVisible();
  await page.keyboard.up('d');
  await page.screenshot({
    path: `output/playwright/v105-${info.project.name}-completed.png`,
  });
  await page.getByRole('button', { name: 'Play Again' }).click();
  await expect(page.locator('#game-canvas')).toBeFocused();
});
