import { test, expect } from '@playwright/test';
import { MapCodec } from '../../src/domain/map-codec.ts';
import { blankLevel } from '../../src/editor/model.ts';
import { levelZip } from '../helpers/package.ts';

test('production enemy package stays bounded and responsive at maximum authored enemy count', async ({
  page,
}, info) => {
  const errors: string[] = [],
    requested: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/assets/enemy-')) requested.push(request.url());
  });
  const level = blankLevel(512, 128);
  level.background = { preset: 'rain', image: './background.png' };
  level.tiles[32]?.fill(2);
  level.spawn = { x: 32, y: 498 };
  level.portal = { x: 8000, y: 480, w: 20, h: 32 };
  level.entities = Array.from({ length: 64 }, (_, i) => ({
    id: `bloom-${i}`,
    type: 'enemy',
    species: 'bloom-sentinel',
    spawn: [256 + (i % 8) * 24, 352 + Math.floor(i / 8) * 16],
    facing: -1,
    patrol: [
      [240 + (i % 8) * 24, 352 + Math.floor(i / 8) * 16],
      [272 + (i % 8) * 24, 352 + Math.floor(i / 8) * 16],
    ],
    overrides: { cooldown: 0.3, detectionRange: 640 },
  }));
  await page.goto('./');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'load.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(JSON.stringify(MapCodec.encodeLevel(level))),
  });
  await expect(page.locator('#game-canvas')).toBeFocused();
  const intervals = await page.evaluate(
    async () =>
      await new Promise<number[]>((resolve) => {
        const values: number[] = [];
        let last = performance.now();
        const sample = (now: number) => {
          values.push(now - last);
          last = now;
          if (values.length < 100) requestAnimationFrame(sample);
          else resolve(values);
        };
        requestAnimationFrame(sample);
      }),
  );
  intervals.sort((a, b) => a - b);
  expect(intervals[Math.floor(intervals.length * 0.95)]).toBeLessThan(150);
  expect(requested.some((url) => url.includes('bloom-sentinel'))).toBe(true);
  expect(
    requested.some((url) =>
      /bramble-guard|thorn-wisp|vine-moth|spore-pod|root-charger/.test(url),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(() => '__game' in window || '__app' in window),
  ).toBe(false);
  expect(
    await page
      .locator('#game-canvas')
      .evaluate((canvas) =>
        canvas instanceof HTMLCanvasElement ? canvas.width * canvas.height : 0,
      ),
  ).toBeLessThanOrEqual(1280 * 800 * 4);
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: `output/playwright/v108-${info.project.name}-enemy-load.png`,
  });
  await page.setViewportSize({ width: 430, height: 932 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({
    path: `output/playwright/v108-${info.project.name}-enemy-portrait.png`,
  });
  expect(errors).toEqual([]);
});

test('production Wildwood selection loads all species and reloads its Day scene', async ({
  page,
}, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page
    .getByRole('button', { name: 'Wildwood Trials', exact: true })
    .click();
  await expect(page.locator('#game-canvas')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'day');
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.keyboard.down('d');
  await page.waitForTimeout(2300);
  await page.keyboard.up('d');
  await page.screenshot({
    path: `output/playwright/v108-${info.project.name}-wildwood.png`,
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
});
