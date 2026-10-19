import { GameSimulation } from '../../src/simulation/game-simulation.ts';
import { MapValidator } from '../../src/simulation/map-validator.ts';
import { replayWildwood } from '../helpers/wildwood-driver.ts';
import type { Input } from '../../src/domain/contracts.ts';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { editor, editorSnapshot, snapshot, start } from './helpers.ts';
import { MapCodec } from '../../src/domain/map-codec.ts';
import { blankLevel } from '../../src/editor/model.ts';
import { exportedJson } from '../helpers/package.ts';

test('chooser aligns built-ins, restores Play focus and opens the Day showcase', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const forest = page.locator('#sample-map'),
    wildwood = page.locator('#wildwood-map');
  const a = await forest.boundingBox(),
    b = await wildwood.boundingBox();
  expect(a?.width).toBe(b?.width);
  expect(a?.height).toBe(b?.height);
  await page.keyboard.press('Escape');
  await expect(page.locator('#play')).toBeFocused();
  await page.locator('#play').click();
  await wildwood.click();
  await expect(page).toHaveURL(/game.html\?map=wildwood-trials/);
  await expect(page.locator('#game-canvas')).toBeFocused();
  await expect
    .poll(async () => (await snapshot(page)).run.state)
    .toBe('playing');
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'day');
  expect(
    await page.evaluate(
      () => window.__game.snapshot().run.enemies.registry.actors.size,
    ),
  ).toBe(9);
});

test('contact defeat shows accessible Retry and resets combat without resetting elapsed/deaths', async ({
  page,
}) => {
  const level = blankLevel(32, 20);
  level.tiles[10]?.fill(2);
  level.spawn = { x: 32, y: 146 };
  level.portal = { x: 480, y: 128, w: 20, h: 32 };
  level.entities = [
    {
      id: 'guard',
      type: 'enemy',
      species: 'bramble-guard',
      spawn: [64, 140],
      facing: -1,
      patrol: [
        [64, 140],
        [80, 140],
      ],
      overrides: {
        contactDamage: 100,
        attackDamage: 100,
        patrolSpeed: 1,
        chaseSpeed: 1,
      },
    },
  ];
  await start(page, JSON.stringify(MapCodec.encodeLevel(level)));
  await page.evaluate(() => window.__game.advance(60, { axis: 1 }));
  await expect(
    page.getByRole('heading', { name: 'Defeated', exact: true }),
  ).toBeVisible();
  const defeated = await snapshot(page);
  expect(defeated.run.falls).toBe(1);
  expect(defeated.run.health.hp).toBe(0);
  await page.waitForTimeout(100);
  expect((await snapshot(page)).run.elapsed).toBe(defeated.run.elapsed);
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#game-canvas')).toBeFocused();
  const retried = await snapshot(page);
  expect(retried.run.health.hp).toBe(100);
  expect(retried.run.health.immunity).toBeGreaterThan(0);
  expect(retried.run.falls).toBe(1);
  expect(retried.run.elapsed).toBeGreaterThanOrEqual(defeated.run.elapsed);
  await page.screenshot({ path: 'output/playwright/v108-retry-hp.png' });
});

test('Editor authors an enemy, applies overrides, duplicates, undoes and exports v5', async ({
  page,
}) => {
  await editor(page);
  await page.locator('[data-enemy="thorn-wisp"]').click();
  const canvas = page.locator('#editor-canvas');
  await canvas.click({ position: { x: 220, y: 160 } });
  const placed = await editorSnapshot(page),
    enemy = placed.level.entities?.find((e) => e.type === 'enemy');
  if (enemy?.type !== 'enemy') throw new Error('Enemy was not authored');
  expect(placed.history).toBe(1);
  await expect(page.locator('.inspector')).toBeHidden();
  await page.locator('[data-tool="inspect"]').click();
  await canvas.click({
    position: {
      x: (enemy.spawn[0] / 16 - placed.camera.x) * 32 * placed.zoom,
      y: (enemy.spawn[1] / 16 - placed.camera.y) * 32 * placed.zoom,
    },
  });
  await expect(
    page.getByRole('heading', { name: 'Thorn Wisp', exact: true }),
  ).toBeVisible();
  await page.locator('[data-enemy-field="attackDamage"]').fill('30');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities).toHaveLength(2);
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await editorSnapshot(page)).level.entities).toHaveLength(1);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const json = JSON.parse(
    await exportedJson(await (await pending).path()),
  ) as unknown;
  const decoded = MapCodec.decodeLevel(json);
  expect(decoded.entities?.[0]?.type).toBe('enemy');
  const exported = decoded.entities?.[0];
  if (exported?.type !== 'enemy') throw new Error('Missing exported enemy');
  expect(exported.overrides?.attackDamage).toBe(30);
});

test('sample ZIP imports all species and preserves Day through resize/undo', async ({
  page,
}) => {
  await editor(page);
  await page.locator('#editor-file').setInputFiles({
    name: 'wildwood.zip',
    mimeType: 'application/zip',
    buffer: readFileSync('public/maps/wildwood-trials.zip'),
  });
  await expect
    .poll(async () => (await editorSnapshot(page)).level.entities?.length)
    .toBe(15);
  await page.getByLabel('Map width').fill('449');
  await page.getByRole('button', { name: 'Resize', exact: true }).click();
  expect((await editorSnapshot(page)).level.background?.preset).toBe('day');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await editorSnapshot(page)).level.width).toBe(448);
  await page.screenshot({ path: 'output/playwright/v108-editor-showcase.png' });
});

test('completes Wildwood Trials using real controls without teleporting or changing health', async ({
  page,
}) => {
  const level = MapValidator.playable(
      MapCodec.parseLevel(
        readFileSync('public/maps/wildwood-trials.json', 'utf8'),
      ),
    ),
    inputs: Input[] = [];
  const run = replayWildwood(new GameSimulation(level), level, inputs);
  expect(run.state).toBe('completed');
  await page.goto('/game.html?map=wildwood-trials');
  await expect(page.locator('#game-canvas')).toBeFocused();
  const result = await page.evaluate((sequence) => {
    window.__game.restart();
    for (const input of sequence) window.__game.advance(1, input);
    return window.__game.snapshot();
  }, inputs);
  expect(result.run.state).toBe('completed');
  expect(result.run.falls).toBe(0);
  await expect(
    page.getByRole('heading', { name: 'Gate reached!' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'output/playwright/v108-wildwood-completed.png',
  });
});
