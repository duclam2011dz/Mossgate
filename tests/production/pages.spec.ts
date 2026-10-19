import { levelZip } from '../helpers/package.ts';
import { required } from '../helpers/required.ts';
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
const hooks = () => ({ app: '__app' in window, game: '__game' in window });
test('production pages and imported maps work below a static-hosting subdirectory', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Mossgate' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(hooks)).toEqual({ app: false, game: false });
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-menu.png`,
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-chooser.png`,
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
    path: `output/playwright/v106-${info.project.name}-editor.png`,
  });
  await page.getByRole('button', { name: 'Show more...', exact: true }).click();
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-inspector-expanded.png`,
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
    name: 'legacy.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(
      readFileSync('public/maps/forest-ruins-legacy.json', 'utf8'),
    ),
  });
  await expect(page).toHaveURL(/\/mossgate\/game.html\?session=/);
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(hooks)).toEqual({ app: false, game: false });
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-game.png`,
  });
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(
    await page.locator('#game-canvas').getAttribute('aria-label'),
  ).not.toContain('expired');
  expect(errors).toEqual([]);
  const bundles = readdirSync('dist/assets').filter((n) => n.endsWith('.js'));
  expect(bundles.length).toBeGreaterThanOrEqual(3);
  for (const file of bundles)
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
    await page.locator('#menu-background').evaluate((c) => {
      if (!(c instanceof HTMLCanvasElement)) throw new Error('Expected canvas');
      return c.height;
    }),
  ).toBeLessThanOrEqual(720);
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-portrait-menu.png`,
  });
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(page.locator('[data-tile="4"]')).toBeVisible();
  expect(
    await page.locator('#editor-canvas').evaluate((c) => {
      if (!(c instanceof HTMLCanvasElement)) throw new Error('Expected canvas');
      return c.width * c.height;
    }),
  ).toBeLessThanOrEqual(480 * 900 * 4);
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-portrait-editor.png`,
  });
  await page.goto('http://127.0.0.1:4183/mossgate/game.html');
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect(
    await page.locator('canvas').evaluate((c) => {
      if (!(c instanceof HTMLCanvasElement)) throw new Error('Expected canvas');
      return c.height;
    }),
  ).toBeLessThanOrEqual(720);
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-portrait-game.png`,
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
  await page.locator('[data-action="background"]').click();
  const weather = page.getByRole('dialog', { name: 'Background' });
  await weather.getByLabel('Background scene').selectOption('rain');
  await weather.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'rain');
  await page.locator('#editor-canvas').focus();
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        let last = performance.now();
        const tick = (now: number) => {
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
  const p95 = required(frames[Math.floor(frames.length * 0.95)]);
  info.annotations.push({
    type: 'performance',
    description: `Maximum map pan p95 ${p95.toFixed(1)} ms`,
  });
  console.log(
    `${info.project.name} maximum-map frame p95: ${p95.toFixed(1)} ms`,
  );
  expect(
    await page.locator('#editor-canvas').evaluate((c) => {
      if (!(c instanceof HTMLCanvasElement)) throw new Error('Expected canvas');
      return c.width * c.height;
    }),
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
    name: 'short.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(
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
    path: `output/playwright/v106-${info.project.name}-pause.png`,
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
    path: `output/playwright/v106-${info.project.name}-completed.png`,
  });
  await page.getByRole('button', { name: 'Play Again' }).click();
  await expect(page.locator('#game-canvas')).toBeFocused();
});

test('production errors and the no-backdrop fallback keep glass content readable', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./game.html?session=expired');
  await expect(
    page.getByRole('dialog', { name: 'Could not enter the forest' }),
  ).toBeVisible();
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-error.png`,
  });
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  // Activate the actual @supports fallback declarations for a visual regression review.
  const fallback = await page.evaluate(() => {
    for (const sheet of document.styleSheets)
      for (const rule of sheet.cssRules) {
        if (
          rule instanceof CSSSupportsRule &&
          rule.conditionText.startsWith('not')
        )
          return [...rule.cssRules].map((rule) => rule.cssText).join('\n');
      }
    throw new Error('Missing no-backdrop fallback');
  });
  await page.addStyleTag({ content: fallback });
  const colors = await page.locator('.menu-content').evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  expect(colors.background).toContain('18, 56, 42');
  expect(colors.color).toBe('rgb(241, 246, 231)');
  await page.screenshot({
    path: `output/playwright/v106-${info.project.name}-fallback.png`,
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#play-options')).toBeVisible();
});

test('Day and Rain packages preserve scenes, wet glass and fallback below a subdirectory', async ({
  page,
}, info) => {
  for (const preset of ['day', 'rain']) {
    await page.goto('./');
    await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
    const raw: unknown = JSON.parse(
      readFileSync('public/maps/forest-ruins-legacy.json', 'utf8'),
    );
    if (typeof raw !== 'object' || raw === null)
      throw new Error('Invalid fixture');
    const text = JSON.stringify({
      ...raw,
      version: 4,
      background: { preset, image: './background.png' },
    });
    await page.locator('#play-file').setInputFiles({
      name: 'scene.zip',
      mimeType: 'application/zip',
      buffer: await levelZip(text),
    });
    await expect(page.locator('#game-canvas')).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-scene', preset);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    if (preset === 'rain') {
      await expect
        .poll(() => page.locator('.water-bead').count())
        .toBeGreaterThan(0);
      await page.addStyleTag({
        content:
          '.water-bead {backdrop-filter:blur(1.2px) contrast(1.15) !important;}',
      });
    }
    await page.screenshot({
      path: `output/playwright/v107-${info.project.name}-${preset}-pause.png`,
    });
    expect(
      await page.evaluate(() => '__app' in window || '__game' in window),
    ).toBe(false);
  }
});
