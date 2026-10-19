import { required } from '../helpers/required.ts';
import { test, expect } from '@playwright/test';
import { start, editor, editorSnapshot, snapshot } from './helpers.ts';
test('HTML pause traps keyboard focus, clears input and resumes once', async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down('d');
  await page.keyboard.press('Escape');
  const overlay = page.getByRole('dialog', { name: 'Paused' }),
    resume = overlay.getByRole('button', { name: 'Resume' });
  await expect(resume).toBeFocused();
  expect(
    await page
      .locator('.game-panel')
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe('relative');
  expect(await page.evaluate(() => window.__game.input.read().axis)).toBe(0);
  await page.keyboard.up('d');
  await page.keyboard.press('Shift+Tab');
  await expect(
    overlay.getByRole('button', { name: 'Main Menu' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(resume).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(overlay.getByRole('button', { name: 'Restart' })).toBeFocused();
  await page.screenshot({
    animations: 'disabled',
    path: 'output/playwright/v106-pause.png',
  });
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(page.locator('#game-canvas')).toBeFocused();
  expect((await snapshot(page)).run.state).toBe('playing');
  await page.waitForTimeout(80);
  expect((await snapshot(page)).run.state).toBe('playing');
  await page.evaluate(() => {
    window.__game.teleport(2464, 384);
    window.__game.advance(1);
  });
  await expect(
    page.getByRole('dialog', { name: 'Gate reached!' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Again' })).toBeFocused();
  await page.screenshot({
    animations: 'disabled',
    path: 'output/playwright/v106-completed.png',
  });
  await page.getByRole('button', { name: 'Play Again' }).click();
  await expect(page.locator('#game-canvas')).toBeFocused();
});
test('glass confirmations are asynchronous, cancel safely and resolve on abort', async ({
  page,
}) => {
  await editor(page);
  await page.locator('#editor-canvas').click({ position: { x: 80, y: 80 } });
  const original = await editorSnapshot(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Unsaved changes' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  expect((await editorSnapshot(page)).level).toEqual(original.level);
  await expect(
    page.getByRole('button', { name: 'Menu', exact: true }),
  ).toBeFocused();
  const result = await page.evaluate(async () => {
    const modulePath = '/src/infrastructure/glass-dialog.ts';
    // The runtime URL points at the same statically checked module in the dev server.
    const { GlassDialog } = (await import(
        modulePath
      )) as typeof import('../../src/infrastructure/glass-dialog.ts'),
      abort = new AbortController(),
      promise = GlassDialog.confirm('Abort test', { signal: abort.signal });
    abort.abort();
    return {
      result: await promise,
      remaining: document.querySelectorAll('.confirmation').length,
    };
  });
  expect(result).toEqual({ result: false, remaining: 0 });
  page.on('dialog', (d) => d.accept());
});
test('glass surfaces remain translucent, tilt is bounded and chooser works with motion', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#menu-background');
    return (
      canvas instanceof HTMLCanvasElement &&
      canvas.getContext('2d')?.getImageData(0, 0, 1, 1).data[3] === 255
    );
  });
  const card = page.locator('.menu-content'),
    rect = await card.boundingBox();
  await page.mouse.move(required(rect).x + 10, required(rect).y + 10);
  await page.waitForTimeout(300);
  const values = await card.evaluate((el) => ({
    x: parseFloat(el.style.getPropertyValue('--tilt-x')),
    y: parseFloat(el.style.getPropertyValue('--tilt-y')),
    blur: getComputedStyle(el).backdropFilter,
    background: getComputedStyle(el).backgroundColor,
  }));
  expect(Math.abs(values.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(values.y)).toBeLessThanOrEqual(4);
  expect(values.blur).toContain('blur');
  expect(values.background).toMatch(/0\.32\)/);
  await page.screenshot({
    animations: 'disabled',
    path: 'output/playwright/v106-menu-tilt.png',
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#play-options')).toBeVisible();
  await expect(page.locator('.menu-content')).toHaveCSS('opacity', '0');
  await page.screenshot({
    animations: 'disabled',
    path: 'output/playwright/v106-chooser.png',
  });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe(
    'none',
  );
});

test('sunlight reflections animate gently, suspend while hidden and freeze with reduced motion', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  const card = page.locator('.menu-content');
  const reflection = () =>
    card.evaluate((el) => {
      const css = getComputedStyle(el, '::before');
      return {
        name: css.animationName,
        duration: css.animationDuration,
        pointer: css.pointerEvents,
        transform: css.transform,
        state: css.animationPlayState,
      };
    });
  const before = await reflection();
  expect(before.name).toBe('glass-sunlight');
  expect(before.duration).toBe('22s');
  expect(before.pointer).toBe('none');
  await expect
    .poll(async () => (await reflection()).transform)
    .not.toBe(before.transform);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await reflection()).state).toBe('paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await reflection()).state).toBe('running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await reflection()).name).toBe('none');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#play-options')).toBeVisible();
  await expect(page.locator('.menu-content')).toHaveCSS('opacity', '0');
});
