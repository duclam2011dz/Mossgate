import { exportedJson, levelZip } from '../helpers/package.ts';
import { MapCodec } from '../../src/domain/map-codec.ts';
import { required } from '../helpers/required.ts';
import { test, expect } from '@playwright/test';
import { editor, editorSnapshot, importEditor } from './helpers.ts';
test('draws connected strokes, undoes, redoes and fills a rectangle', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await editor(page);
  const box = await page.locator('#editor-canvas').boundingBox();
  await page.mouse.move(required(box).x + 16, required(box).y + 16);
  await page.mouse.down();
  await page.mouse.move(required(box).x + 6 * 32 + 16, required(box).y + 16, {
    steps: 2,
  });
  await page.mouse.up();
  expect(
    required((await editorSnapshot(page)).level.tiles[0]).slice(0, 7),
  ).toEqual(Array(7).fill(1));
  expect((await editorSnapshot(page)).history).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(required((await editorSnapshot(page)).level.tiles[0])[3]).toBe(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(required((await editorSnapshot(page)).level.tiles[0])[3]).toBe(1);
  await page.locator('[data-tool="rectangle"]').click();
  await page.mouse.move(required(box).x + 16, required(box).y + 80);
  await page.mouse.down();
  await page.mouse.move(required(box).x + 112, required(box).y + 144);
  await page.mouse.up();
  expect(required((await editorSnapshot(page)).level.tiles[3])[2]).toBe(1);
  await page.getByRole('button', { name: 'Ice', exact: true }).click();
  await page.locator('[data-tool="fill"]').click();
  await page.mouse.click(required(box).x + 48, required(box).y + 112);
  expect(required((await editorSnapshot(page)).level.tiles[3])[2]).toBe(4);
  await page.screenshot({ path: 'output/playwright/editor.png' });
  expect(errors).toEqual([]);
  page.on('dialog', (dialog) => dialog.accept());
});
test('copy/paste, move preview cancel, pan/zoom and minimap work on both axes', async ({
  page,
}) => {
  await editor(page);
  await importEditor(page);
  const canvas = page.locator('#editor-canvas'),
    box = await canvas.boundingBox();
  await page.getByLabel('Zoom', { exact: true }).selectOption('.25');
  await page.locator('[data-tool="select"]').click();
  await page.mouse.move(required(box).x + 10, required(box).y + 245);
  await page.mouse.down();
  await page.mouse.move(required(box).x + 35, required(box).y + 265);
  await page.mouse.up();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.mouse.move(required(box).x + 140, required(box).y + 100);
  await page.keyboard.press('Enter');
  expect((await editorSnapshot(page)).dirty).toBe(true);
  await page.getByLabel('Zoom', { exact: true }).selectOption('1');
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await page.waitForTimeout(200);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  let snap = await editorSnapshot(page);
  expect(snap.camera.x).toBeGreaterThan(0);
  expect(snap.camera.y).toBeGreaterThan(0);
  const mini = await page.locator('#minimap').boundingBox();
  await page.mouse.click(
    required(mini).x + required(mini).width * 0.8,
    required(mini).y + required(mini).height * 0.7,
  );
  snap = await editorSnapshot(page);
  expect(snap.camera.x).toBeGreaterThan(20);
  expect(snap.camera.y).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await page.mouse.move(required(box).x + 100, required(box).y + 100);
  await page.mouse.wheel(0, -300);
  await expect
    .poll(async () => (await editorSnapshot(page)).zoom)
    .toBeGreaterThan(0.25);
  page.on('dialog', (dialog) => dialog.accept());
});
test('exported JSON reimports through Play and dirty navigation can be cancelled', async ({
  page,
}) => {
  await editor(page);
  await importEditor(page);
  await page.locator('[data-tile="4"]').click();
  await page.locator('#editor-canvas').click({ position: { x: 80, y: 80 } });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page
    .locator('.confirmation')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.locator('#editor-canvas')).toBeVisible();
  expect((await editorSnapshot(page)).dirty).toBe(true);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await pending;
  const text = await exportedJson(await download.path());
  expect(MapCodec.encodeLevel(MapCodec.parseLevel(text)).version).toBe(4);
  expect((await editorSnapshot(page)).dirty).toBe(false);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('.menu')).toBeVisible();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'exported.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(text),
  });
  await expect(page.locator('#game-canvas')).toBeVisible();
});
test('draft export is editable but refused by Play; invalid imports preserve the document', async ({
  page,
}) => {
  await editor(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const text = await exportedJson(await (await pending).path());
  expect(MapCodec.encodeLevel(MapCodec.parseLevel(text)).spawn).toBeNull();
  await page.locator('#editor-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.locator('#editor-notice')).toContainText(
    'unsupported version',
  );
  expect((await editorSnapshot(page)).level.width).toBe(160);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'draft.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(text),
  });
  await expect(page.getByRole('status')).toContainText('Spawn is not placed');
});
test('maximum map, resize marker removal and undo remain responsive', async ({
  page,
}) => {
  await editor(page);
  await page.getByLabel('Map width').fill('512');
  await page.getByLabel('Map height').fill('128');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  expect((await editorSnapshot(page)).level.width).toBe(512);
  await page.locator('[data-tool="fill"]').click();
  await page.locator('#editor-canvas').click({ position: { x: 15, y: 15 } });
  expect(required((await editorSnapshot(page)).level.tiles[127])[511]).toBe(1);
  expect(
    await page.locator('#editor-canvas').evaluate((c) => {
      if (!(c instanceof HTMLCanvasElement)) throw new Error('Expected canvas');
      return c.width * c.height;
    }),
  ).toBeLessThan(1280 * 800 * 4);
  await page.screenshot({ path: 'output/playwright/editor-max.png' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(required((await editorSnapshot(page)).level.tiles[127])[511]).toBe(0);
  await page.locator('[data-tool="portal"]').click();
  await page.locator('#editor-canvas').click({ position: { x: 700, y: 400 } });
  await page.getByLabel('Map width').fill('16');
  await page.getByLabel('Map height').fill('12');
  await page.getByRole('button', { name: 'Resize', exact: true }).click();
  await page
    .locator('.confirmation')
    .getByRole('button', { name: 'Resize', exact: true })
    .click();
  expect((await editorSnapshot(page)).level.portal).toBeNull();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await editorSnapshot(page)).level.portal).not.toBeNull();
  page.on('dialog', (d) => d.accept());
});

test('selection moves are previewed, cancellable and undoable as one action', async ({
  page,
}) => {
  await editor(page);
  const box = await page.locator('#editor-canvas').boundingBox();
  await page.mouse.click(required(box).x + 80, required(box).y + 80);
  await page.locator('[data-tool="select"]').click();
  await page.mouse.move(required(box).x + 70, required(box).y + 70);
  await page.mouse.down();
  await page.mouse.move(required(box).x + 120, required(box).y + 120);
  await page.mouse.up();
  await page.mouse.move(required(box).x + 80, required(box).y + 80);
  await page.mouse.down();
  await page.mouse.move(required(box).x + 208, required(box).y + 144);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  expect(required((await editorSnapshot(page)).level.tiles[2])[2]).toBe(1);
  expect(required((await editorSnapshot(page)).level.tiles[4])[6]).toBe(0);
  await page.mouse.move(required(box).x + 80, required(box).y + 80);
  await page.mouse.down();
  await page.mouse.move(required(box).x + 208, required(box).y + 144);
  await page.mouse.up();
  await page.keyboard.press('Enter');
  expect(required((await editorSnapshot(page)).level.tiles[2])[2]).toBe(0);
  expect(required((await editorSnapshot(page)).level.tiles[4])[6]).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(required((await editorSnapshot(page)).level.tiles[2])[2]).toBe(1);
  expect(required((await editorSnapshot(page)).level.tiles[4])[6]).toBe(0);
  page.on('dialog', (d) => d.accept());
});
test('authors spawn and portal on a new map and exports a playable document', async ({
  page,
}) => {
  await editor(page);
  await page.getByLabel('Map width').fill('32');
  await page.getByLabel('Map height').fill('16');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const box = await page.locator('#editor-canvas').boundingBox();
  await page.locator('[data-tool="rectangle"]').click();
  await page.mouse.move(required(box).x + 16, required(box).y + 400);
  await page.mouse.down();
  await page.mouse.move(required(box).x + 1008, required(box).y + 496);
  await page.mouse.up();
  await page.locator('[data-tool="spawn"]').click();
  await page.mouse.click(required(box).x + 80, required(box).y + 368);
  await page.locator('[data-tool="portal"]').click();
  await page.mouse.click(required(box).x + 880, required(box).y + 336);
  await expect(page.locator('#editor-notice')).toContainText('Ready to play');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const text = await exportedJson(await (await pending).path());
  const data = MapCodec.encodeLevel(MapCodec.parseLevel(text));
  expect(data.spawn).toEqual([35, 178]);
  expect(data.portal).toEqual([432, 160, 20, 32]);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'created.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(text),
  });
  await expect(page.locator('#game-canvas')).toBeFocused();
});
