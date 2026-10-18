import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { editor, importEditor, editorSnapshot } from './helpers.js';
test('edits type and cell properties, cancels scope changes and exports v3', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await editor(page);
  await importEditor(page);
  await page.getByLabel('Zoom', { exact: true }).selectOption('.5');
  await page.locator('[data-tile="4"]').click();
  const panel = page.getByRole('complementary', { name: 'Tile inspector' });
  await expect(panel).toBeHidden();
  const initialBox = await page.locator('#editor-canvas').boundingBox();
  await page.mouse.click(initialBox.x + 24, initialBox.y + 488);
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.click(initialBox.x + 24, initialBox.y + 488);
  await expect(panel).toBeVisible();
  await panel.getByLabel('Property scope').selectOption('type');
  await panel.getByLabel('Friction multiplier', { exact: true }).fill('0');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  expect((await editorSnapshot(page)).level.tileDefaults[4].friction).toBe(0);
  await panel
    .getByRole('button', { name: 'Show more...', exact: true })
    .click();
  await expect(panel).toHaveClass(/expanded/);
  await panel.getByLabel('Effect color', { exact: true }).fill('#c5a755');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/inspector-expanded.png' });
  await panel.getByRole('button', { name: 'Close inspector' }).click();
  let box = await page.locator('#editor-canvas').boundingBox();
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.click(box.x + 24, box.y + 488);
  await expect(panel.getByLabel('Property scope')).toHaveValue('cell');
  await panel.getByLabel('Speed multiplier', { exact: true }).fill('0');
  await panel.getByLabel('Property scope').selectOption('type');
  await page
    .locator('.decision')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(panel.getByLabel('Property scope')).toHaveValue('cell');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  expect((await editorSnapshot(page)).level.cellOverrides['1,30'].speed).toBe(
    0,
  );
  await panel
    .getByRole('button', { name: 'Show more...', exact: true })
    .click();
  await panel.getByLabel('Hitbox width', { exact: true }).fill('17');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Invalid width');
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await panel.getByRole('button', { name: 'Close inspector' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const data = JSON.parse(readFileSync(await (await pending).path(), 'utf8'));
  expect(data.version).toBe(3);
  expect(data.tileDefaults[4].friction).toBe(0);
  expect(
    data.cellOverrides.some(
      ([x, y, p]) => x === 1 && y === 30 && p.speed === 0,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('creates a saw path, edits waypoints and deletes with undo', async ({
  page,
}) => {
  await editor(page);
  const canvas = page.locator('#editor-canvas'),
    box = await canvas.boundingBox();
  await page.locator('[data-tool="saw"]').click();
  await page.mouse.click(box.x + 80, box.y + 80);
  await page.mouse.click(box.x + 208, box.y + 80);
  await page.keyboard.press('Enter');
  expect((await editorSnapshot(page)).level.entities).toHaveLength(1);
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.click(box.x + 64, box.y + 64);
  const panel = page.getByRole('complementary', { name: 'Tile inspector' });
  await expect(
    panel.getByRole('heading', { name: 'Moving saw' }),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: 'Show more...', exact: true })
    .click();
  await panel.getByLabel('Saw speed', { exact: true }).fill('96');
  await panel.getByLabel('Waypoint 2 Y', { exact: true }).fill('128');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities[0].speed).toBe(96);
  expect((await editorSnapshot(page)).level.entities[0].path[1][1]).toBe(128);
  await panel
    .getByRole('button', { name: 'Add waypoint', exact: true })
    .click();
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities[0].path).toHaveLength(3);
  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities).toHaveLength(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities).toHaveLength(1);
  page.on('dialog', (d) => d.accept());
});
test('Play choices launch the built-in challenge and respect reduced motion', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.screenshot({ path: 'output/playwright/menu-v103.png' });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('#play-options')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Forest Ruins', exact: true }).click();
  await expect(page.locator('#game-canvas')).toBeFocused();
  await expect
    .poll(
      async () =>
        await page.evaluate(() => window.__game?.snapshot().run.state),
    )
    .toBe('playing');
  await page.screenshot({ path: 'output/playwright/challenge-v103.png' });
  expect(errors).toEqual([]);
});
