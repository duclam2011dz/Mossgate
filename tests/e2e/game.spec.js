import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { start, snapshot } from './helpers.js';
test('menu has only two actions and invalid or cancelled files stay on menu', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mossgate' })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(2);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open JSON file', exact: true })
    .click();
  await chooser;
  await page.locator('#play-file').dispatchEvent('cancel');
  await expect(page.locator('.menu')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  });
  await expect(page.getByRole('status')).toContainText('Could not open map');
  await expect(page.locator('.menu')).toBeVisible();
  await page.screenshot({ path: 'output/playwright/menu.png' });
});
test('imports a v1 map, moves, jumps, dashes and pauses with HTML pause controls', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator('#app button:visible')).toHaveCount(0);
  expect(await page.locator('canvas').boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
  });
  const before = await snapshot(page);
  await page.keyboard.down('d');
  await expect
    .poll(async () => (await snapshot(page)).run.player.x)
    .toBeGreaterThan(before.run.player.x + 15);
  await page.keyboard.up('d');
  await page.keyboard.down('w');
  await expect
    .poll(async () => (await snapshot(page)).run.player.vy)
    .toBeLessThan(0);
  await page.keyboard.up('w');
  await page.keyboard.press('Tab');
  await expect
    .poll(async () => (await snapshot(page)).run.player.cooldown)
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'output/playwright/game-v102.png' });
  await page.keyboard.press('Escape');
  const paused = await snapshot(page);
  await page.waitForTimeout(100);
  expect((await snapshot(page)).run.elapsed).toBe(paused.run.elapsed);
  expect((await snapshot(page)).anim).toEqual(paused.anim);
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await snapshot(page)).run.state)
    .toBe('playing');
  expect(errors).toEqual([]);
});
test('crouches, resizes, dies, completes and returns to menu', async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down('Shift');
  await expect.poll(async () => (await snapshot(page)).run.player.h).toBe(8);
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await snapshot(page)).run.player.h).toBe(14);
  await page.keyboard.press('Escape');
  const paused = (await snapshot(page)).run;
  await page.setViewportSize({ width: 480, height: 900 });
  await expect.poll(async () => (await snapshot(page)).viewport.width).toBe(96);
  expect((await snapshot(page)).run).toEqual(paused);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__game.teleport(200, 710));
  await expect.poll(async () => (await snapshot(page)).run.falls).toBe(1);
  await page.evaluate(() => window.__game.teleport(2464, 384));
  await expect
    .poll(async () => (await snapshot(page)).run.state)
    .toBe('completed');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).run.falls).toBe(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('.menu')).toBeVisible();
  expect(await page.evaluate(() => typeof window.__game)).toBe('undefined');
});
test('focus return never resumes automatically and Restart clears the run', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect
    .poll(async () => (await snapshot(page)).run.state)
    .toBe('paused');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await snapshot(page)).run.state).toBe('paused');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await snapshot(page)).run.state)
    .toBe('playing');
  expect((await snapshot(page)).run.elapsed).toBeLessThan(1);
});
test('showcase plays special tiles and reduced motion suppresses shake', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(
    page,
    readFileSync(
      new URL('../../public/maps/tile-showcase.json', import.meta.url),
      'utf8',
    ),
  );
  await page.evaluate(() => {
    window.__game.teleport(14 * 16 + 2, 466);
    window.__game.advance(10, { axis: 1 });
  });
  expect((await snapshot(page)).run.player.vx).toBeLessThan(40);
  await page.evaluate(() => {
    window.__game.teleport(96 * 16 - 14, 466);
    window.__game.advance(8, { dashPressed: true });
  });
  expect(
    await page.evaluate(() => window.__game.snapshot().run.broken.size),
  ).toBeGreaterThan(0);
  expect((await snapshot(page)).effects.shake).toBe(0);
  await page.evaluate(() => {
    window.__game.teleport(52 * 16, 457);
    window.__game.advance(1);
  });
  expect((await snapshot(page)).run.falls).toBe(1);
});
test('asset loading failure shows a glass error and returns to menu', async ({
  page,
}) => {
  await page.route('**/assets/player.png', (route) => route.abort());
  await startMenuImport(page);
  await expect(page.getByRole('alert')).toContainText('player.png');
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toBeVisible();
});
async function startMenuImport(page) {
  await page.goto('/');
  const data = readFileSync(
    new URL('../../public/maps/forest-ruins-legacy.json', import.meta.url),
  );
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'map.json',
    mimeType: 'application/json',
    buffer: data,
  });
}
test('HiDPI buffers remain bounded', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  await start(page);
  expect(
    await page.locator('canvas').evaluate((c) => [c.width, c.height]),
  ).toEqual([1152, 720]);
  await page.screenshot({ path: 'output/playwright/hidpi-v102.png' });
  await context.close();
});
