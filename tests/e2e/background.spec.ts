import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { BlobReader, BlobWriter, ZipReader, ZipWriter } from '@zip.js/zip.js';
import { PNG } from 'pngjs';
import { MapCodec } from '../../src/domain/map-codec.ts';
import { source } from '../helpers/level.ts';
import { levelZip } from '../helpers/package.ts';
import { editor, editorSnapshot } from './helpers.ts';
test('Menu applies scenes, cancels previews and remembers its own choice in the tab', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#background-choice').click();
  const dialog = page.getByRole('dialog', { name: 'Background' });
  await dialog.getByLabel('Background scene').selectOption('day');
  await expect(
    dialog.getByRole('button', { name: 'Apply', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'night');
  await page.locator('#background-choice').click();
  await dialog.getByLabel('Background scene').selectOption('day');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'day');
  expect(
    await page
      .locator('.menu-content')
      .evaluate((el) => getComputedStyle(el).backdropFilter),
  ).toContain('3px');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'output/playwright/v107-menu-day.png' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'day');
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'night');
});
test('Editor stages backgrounds, supports undo/redo, and preserves custom atlas bytes through ZIP and Game reload', async ({
  page,
}) => {
  await editor(page);
  await page.locator('#editor-file').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  });
  await expect
    .poll(async () => (await editorSnapshot(page)).level.spawn?.x)
    .toBe(48);
  await page.locator('[data-action="background"]').click();
  const dialog = page.getByRole('dialog', { name: 'Background' });
  await dialog.getByLabel('Background scene').selectOption('rain');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'rain');
  expect((await editorSnapshot(page)).dirty).toBe(true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'night');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'rain');
  const image = PNG.sync.read(
    readFileSync('public/assets/background-day-atlas.png'),
  );
  image.data[0] = 213;
  const custom = PNG.sync.write(image);
  await page.locator('[data-action="background"]').click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'custom.png',
    mimeType: 'image/png',
    buffer: custom,
  });
  await expect(dialog.locator('.atlas-label')).toContainText('Custom atlas');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe('mossgate-map.zip');
  const bytes = new Uint8Array(readFileSync(await downloaded.path()));
  const reader = new ZipReader(new BlobReader(new Blob([bytes])), {
    useWebWorkers: false,
  });
  try {
    const entries = await reader.getEntries();
    const png = entries.find((e) => e.filename.endsWith('/background.png'));
    if (!png || png.directory) throw new Error('Missing PNG');
    expect(
      Buffer.from(
        await (await png.getData(new BlobWriter())).arrayBuffer(),
      ).equals(custom),
    ).toBe(true);
  } finally {
    await reader.close();
  }
  expect((await editorSnapshot(page)).dirty).toBe(false);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'custom.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(bytes),
  });
  await expect(page.locator('#game-canvas')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'rain');
  await page.reload();
  await expect(page.locator('#game-canvas')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'rain');
  await page.keyboard.press('Escape');
  await expect(page.locator('.glass-water')).toHaveCount(1);
  await page.screenshot({
    path: 'output/playwright/v107-custom-rain-pause.png',
  });
});
test('Rain and wet glass keep moving while paused, are bounded and respect reduced/hidden motion', async ({
  page,
}) => {
  const level = MapCodec.parseLevel(source);
  level.background = { preset: 'rain', image: './background.png' };
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  await page.locator('#play-file').setInputFiles({
    name: 'rain.zip',
    mimeType: 'application/zip',
    buffer: await levelZip(JSON.stringify(MapCodec.encodeLevel(level))),
  });
  await expect(page.locator('#game-canvas')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.locator('.water-bead').count())
    .toBeGreaterThan(0);
  expect(await page.locator('.water-bead').count()).toBeLessThanOrEqual(180);
  const elapsed = await page.evaluate(
      () => window.__game.snapshot().run.elapsed,
    ),
    bead = page.locator('.water-bead').first(),
    before = await bead.getAttribute('style');
  await expect.poll(() => bead.getAttribute('style')).not.toBe(before);
  expect(await page.evaluate(() => window.__game.snapshot().run.elapsed)).toBe(
    elapsed,
  );
  const checksum = () =>
    page.locator('canvas').evaluate((c) => {
      if (!(c instanceof HTMLCanvasElement)) throw new Error('Canvas required');
      return c.toDataURL();
    });
  const image = await checksum();
  await expect.poll(checksum).not.toBe(image);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const frozen = await bead.evaluate((node) => node.style.transform);
  await page.waitForTimeout(150);
  expect(await bead.evaluate((node) => node.style.transform)).toBe(frozen);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await checksum();
  await page.waitForTimeout(150);
  expect(await checksum()).toBe(hidden);
  await page.screenshot({
    path: 'output/playwright/v107-rain-reduced-pause.png',
  });
});
test('Import rejects ZIP extras, corrupt PNGs, bad dimensions and raw JSON without leaving Menu', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('aria-busy', 'false');
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  await writer.add(
    'map/level.json',
    new BlobReader(
      new Blob([
        JSON.stringify(MapCodec.encodeLevel(MapCodec.parseLevel(source))),
      ]),
    ),
  );
  await writer.add('map/background.png', new BlobReader(new Blob(['not PNG'])));
  const corrupt = Buffer.from(await (await writer.close()).arrayBuffer());
  for (const buffer of [Buffer.from(source), corrupt]) {
    await page.locator('#play-file').setInputFiles({
      name: 'level.zip',
      mimeType: 'application/zip',
      buffer,
    });
    await expect(page.locator('#menu-message')).not.toBeEmpty();
    await expect(page.locator('.menu')).toBeVisible();
  }
  await editor(page);
  await page.locator('[data-action="background"]').click();
  const dialog = page.getByRole('dialog', { name: 'Background' });
  await dialog.locator('input').setInputFiles({
    name: 'wrong.png',
    mimeType: 'image/png',
    buffer: readFileSync('public/assets/grass.png'),
  });
  await expect(dialog.getByRole('status')).toContainText('2560');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await editorSnapshot(page)).dirty).toBe(false);
});

test('Editor ZIP import keeps incoming atlas alive across discard/cancel guards', async ({
  page,
}) => {
  await editor(page);
  await page.locator('#editor-canvas').click({ position: { x: 80, y: 80 } });
  const level = MapCodec.parseLevel(source);
  level.background = { preset: 'rain', image: './background.png' };
  const buffer = await levelZip(JSON.stringify(MapCodec.encodeLevel(level)));
  await page
    .locator('#editor-file')
    .setInputFiles({ name: 'rain.zip', mimeType: 'application/zip', buffer });
  await page
    .getByRole('dialog', { name: 'Unsaved changes' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  expect((await editorSnapshot(page)).dirty).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'night');
  await page
    .locator('#editor-file')
    .setInputFiles({ name: 'rain.zip', mimeType: 'application/zip', buffer });
  await page
    .getByRole('dialog', { name: 'Unsaved changes' })
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'rain');
  expect((await editorSnapshot(page)).dirty).toBe(false);
  expect((await editorSnapshot(page)).level.background?.image).toContain(
    './custom-',
  );
  await expect(page.locator('#editor-notice')).toContainText('Ready to play');
});
