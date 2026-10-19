import { exportedJson } from '../helpers/package.ts';
import { MapCodec } from '../../src/domain/map-codec.ts';
import { required } from '../helpers/required.ts';
import { test, expect } from '@playwright/test';
import { editor, importEditor, editorSnapshot } from './helpers.ts';
test('edits type and cell properties, cancels scope changes and exports v3', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await editor(page);
  await importEditor(page);
  await page.getByLabel('Zoom', { exact: true }).selectOption('.5');
  await page.locator('[data-tile="4"]').click();
  const panel = page.getByRole('complementary', { name: 'Tile inspector' });
  await expect(panel).toBeHidden();
  const initialBox = await page.locator('#editor-canvas').boundingBox();
  await page.mouse.click(
    required(initialBox).x + 24,
    required(initialBox).y + 488,
  );
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.click(
    required(initialBox).x + 24,
    required(initialBox).y + 488,
  );
  await expect(panel).toBeVisible();
  await panel.getByLabel('Property scope').selectOption('type');
  await panel.getByLabel('Friction multiplier', { exact: true }).fill('0');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  expect(
    required(required((await editorSnapshot(page)).level.tileDefaults)[4])
      .friction,
  ).toBe(0);
  await panel
    .getByRole('button', { name: 'Show more...', exact: true })
    .click();
  await expect(panel).toHaveClass(/expanded/);
  await panel.getByLabel('Effect color', { exact: true }).fill('#c5a755');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/inspector-expanded.png' });
  await panel.getByRole('button', { name: 'Close inspector' }).click();
  const box = await page.locator('#editor-canvas').boundingBox();
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.click(required(box).x + 24, required(box).y + 488);
  await expect(panel.getByLabel('Property scope')).toHaveValue('cell');
  await panel.getByLabel('Speed multiplier', { exact: true }).fill('0');
  await panel.getByLabel('Property scope').selectOption('type');
  await page
    .locator('.decision')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(panel.getByLabel('Property scope')).toHaveValue('cell');
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  expect(
    required(required((await editorSnapshot(page)).level.cellOverrides)['1,30'])
      .speed,
  ).toBe(0);
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
  const data = MapCodec.encodeLevel(
    MapCodec.parseLevel(await exportedJson(await (await pending).path())),
  );
  expect(data.version).toBe(5);
  expect(required(required(data.tileDefaults)[4]).friction).toBe(0);
  expect(
    required(data.cellOverrides).some(
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
  await page.mouse.click(required(box).x + 80, required(box).y + 80);
  await page.mouse.click(required(box).x + 208, required(box).y + 80);
  await page.keyboard.press('Enter');
  expect((await editorSnapshot(page)).level.entities).toHaveLength(1);
  await page.locator('[data-tool="inspect"]').click();
  await page.mouse.click(required(box).x + 64, required(box).y + 64);
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
  expect(
    required(
      required((await editorSnapshot(page)).level.entities).find(
        (e) => e.type === 'saw',
      ),
    ).speed,
  ).toBe(96);
  expect(
    required(
      required(
        required((await editorSnapshot(page)).level.entities).find(
          (e) => e.type === 'saw',
        ),
      ).path[1],
    )[1],
  ).toBe(128);
  await panel
    .getByRole('button', { name: 'Add waypoint', exact: true })
    .click();
  await panel.getByRole('button', { name: 'Apply', exact: true }).click();
  expect(
    required(
      required((await editorSnapshot(page)).level.entities).find(
        (e) => e.type === 'saw',
      ),
    ).path,
  ).toHaveLength(3);
  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities).toHaveLength(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities).toHaveLength(1);
  page.on('dialog', (d) => d.accept());
});
test('Play choices launch the built-in challenge and respect reduced motion', async ({
  page,
}) => {
  const errors: string[] = [];
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
