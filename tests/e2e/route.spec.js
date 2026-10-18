import { readFileSync } from 'node:fs';
import { parseLevel } from '../../src/domain/map-codec.js';
import { replayChallenge } from '../helpers/challenge-driver.js';
import { test, expect } from '@playwright/test';
import { segments } from '../helpers/level.js';
import { start } from './helpers.js';
test('finishes the whole level from spawn without dash or teleport', async ({
  page,
}) => {
  await start(page);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__game.snapshot())).run.state,
    )
    .toBe('playing');
  const result = await page.evaluate((platforms) => {
    let segment = 0,
      highest = Infinity,
      lowest = -Infinity;
    for (let frame = 0; frame < 3600; frame++) {
      const { run, camera } = window.__game.snapshot();
      highest = Math.min(highest, camera.y);
      lowest = Math.max(lowest, camera.y);
      if (run.state === 'completed') return { run, highest, lowest };
      const p = run.player;
      while (
        segment < platforms.length - 1 &&
        p.x >= platforms[segment + 1][0] * 16
      )
        segment++;
      const jump =
        segment < platforms.length - 1 &&
        p.grounded &&
        p.x + p.w >= (platforms[segment][1] + 1) * 16 - 10;
      window.__game.advance(1, { axis: 1, jumpPressed: jump, jumpHeld: true });
      if (run.falls) break;
    }
    return { ...window.__game.snapshot(), highest, lowest };
  }, segments);
  expect(result.run.state).toBe('completed');
  expect(result.run.falls).toBe(0);
  expect(result.lowest - result.highest).toBeGreaterThan(80);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__game.snapshot())).run.state,
    )
    .toBe('completed');
});

test('replays the complete five-stage challenge without teleporting', async ({
  page,
}) => {
  const source = readFileSync(
      new URL('../../public/maps/forest-ruins.json', import.meta.url),
      'utf8',
    ),
    level = parseLevel(source),
    { inputs } = replayChallenge(level);
  await start(page, source);
  const result = await page.evaluate((sequence) => {
    window.__game.restart();
    for (const input of sequence) window.__game.advance(1, input);
    return window.__game.snapshot();
  }, inputs);
  expect(result.run.state).toBe('completed');
  expect(result.run.falls).toBe(0);
  expect(result.run.checkpoint).toBe('checkpoint-4');
  await page.screenshot({ path: 'output/playwright/challenge-finished.png' });
});
