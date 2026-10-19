import { levelZip } from '../helpers/package.ts';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { source } from '../helpers/level.ts';
export const snapshot = (page: Page) =>
  page.evaluate(() => window.__game.snapshot());
export const editorSnapshot = (page: Page) =>
  page.evaluate(() => {
    const app = window.__app;
    if (app.route !== 'editor') throw new Error('Editor is not active');
    return app.editor();
  });
export async function start(page: Page, data = source) {
  await page.goto('/#/menu');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'level.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(data),
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
export async function editor(page: Page) {
  await page.goto('/editor.html');
  await expect(page.locator('#editor-canvas')).toBeVisible();
  await page.waitForFunction(() => window.__app?.route === 'editor');
}
export async function importEditor(page: Page, text = source) {
  await page.locator('#editor-file').setInputFiles({
    name: 'map.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect
    .poll(async () => (await editorSnapshot(page)).level.spawn?.x)
    .toBe(48);
}
