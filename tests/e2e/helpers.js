import { expect } from '@playwright/test';
import { source } from '../helpers/level.js';
export const snapshot = (page) => page.evaluate(() => window.__game.snapshot());
export const editorSnapshot = (page) =>
  page.evaluate(() => window.__app.editor());
export async function start(page, data = source) {
  await page.goto('/#/menu');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'level.json',
    mimeType: 'application/json',
    buffer: Buffer.from(data),
  });
  await page.waitForURL('**/game.html?session=*');
  await expect(page.locator('#game-canvas')).toBeFocused();
  await expect
    .poll(
      async () =>
        await page.evaluate(() => window.__game?.snapshot().run.state),
    )
    .toBe('playing');
  await expect(page.locator('#game-canvas')).toBeFocused();
}
export async function editor(page) {
  await page.goto('/#/editor');
  await expect(page.locator('#editor-canvas')).toBeVisible();
  await page.waitForFunction(() => !!window.__app?.editor);
}
export async function importEditor(page, text = source) {
  await page.locator('#editor-file').setInputFiles({
    name: 'map.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect
    .poll(async () => (await editorSnapshot(page)).level.spawn?.x)
    .toBe(48);
}
