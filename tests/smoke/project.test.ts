import { MapValidator } from '../../src/simulation/map-validator.ts';
import { required } from '../helpers/required.ts';
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import {
  generateAssets,
  assetManifest,
} from '../../scripts/generate-assets.ts';
import { level, segments, source } from '../helpers/level.ts';
import { solidTiles } from '../../src/simulation/collision.ts';
import { parseLevel } from '../../src/domain/map-codec.ts';
import { replayChallenge } from '../helpers/challenge-driver.ts';
it('has a compact finite map and clear spawn and gate', () => {
  expect(level.tiles).toHaveLength(level.height);
  for (const row of level.tiles) expect(row).toHaveLength(level.width);
  expect(solidTiles(level, { ...level.spawn, w: 10, h: 14 })).toHaveLength(0);
  expect(solidTiles(level, level.portal)).toHaveLength(0);
  expect(Buffer.byteLength(source)).toBeLessThan(
    Buffer.byteLength(JSON.stringify(level.tiles)) / 10,
  );
  expect(source.trim()).toBe(JSON.stringify(JSON.parse(source)));
  for (let i = 1; i < segments.length; i++) {
    expect(
      required(segments[i])[0] - required(segments[i - 1])[1] - 1,
    ).toBeLessThanOrEqual(2);
    expect(
      Math.max(0, required(segments[i - 1])[2] - required(segments[i])[2]) * 16,
    ).toBeLessThanOrEqual(32);
  }
});
it('ships detailed, correctly sized reproducible PNGs', () => {
  const first = generateAssets(),
    second = generateAssets();
  for (const [name, buffer] of Object.entries(first)) {
    const stored = readFileSync(
      new URL(`../../public/assets/${name}.png`, import.meta.url),
    );
    expect(stored.equals(buffer)).toBe(true);
    expect(required(second[name]).equals(buffer)).toBe(true);
    const png = PNG.sync.read(stored);
    const dimensions = name.endsWith('-atlas')
      ? [2560, 1920]
      : name === 'background' || name.startsWith('background-')
        ? [1280, 960]
        : name === 'portal'
          ? [128, 128]
          : ['trap-crumble', 'entity-saw'].includes(name)
            ? [768, 64]
            : name.startsWith('player-')
              ? [required(assetManifest.player[name.slice(7)]).frames * 64, 64]
              : name.startsWith('effect-')
                ? [384, 32]
                : [64, 64];
    expect([png.width, png.height]).toEqual(dimensions);
    if (name.startsWith('player-')) {
      const frames = required(assetManifest.player[name.slice(7)]).frames,
        signatures = new Set();
      for (let frame = 0; frame < frames; frame++) {
        const rows = [];
        for (let y = 0; y < 64; y++) {
          const start = (y * png.width + frame * 64) * 4;
          rows.push(png.data.subarray(start, start + 64 * 4));
        }
        signatures.add(Buffer.concat(rows).toString('base64'));
      }
      expect(signatures.size, `distinct poses for ${name}`).toBeGreaterThan(1);
    }
    // New art contains native-resolution details, not nearest-neighbor 4x copies.
    let nativeChanges = 0;
    for (let y = 0; y < png.height; y += 4)
      for (let x = 1; x < png.width; x += 4) {
        const i = (y * png.width + x) * 4;
        if (!png.data.subarray(i, i + 4).equals(png.data.subarray(i - 4, i)))
          nativeChanges++;
      }
    expect(nativeChanges, name).toBeGreaterThan(
      name === 'timed-spikes-retracted' ? 0 : 5,
    );
  }
}, 30000);

it('ships matching manifest and an importable special-tile showcase', () => {
  expect(
    JSON.parse(
      readFileSync(
        new URL('../../public/assets/manifest.json', import.meta.url),
        'utf8',
      ),
    ),
  ).toEqual(assetManifest);
  const showcase = parseLevel(
    readFileSync(
      new URL('../../public/maps/tile-showcase.json', import.meta.url),
      'utf8',
    ),
  );
  for (let id = 4; id <= 12; id++)
    expect(showcase.tiles.some((row) => row.some((tile) => tile === id))).toBe(
      true,
    );
});

it('challenge course has five stages, four safe checkpoints and a complete legal input replay', () => {
  const level = parseLevel(
    readFileSync(
      new URL('../../public/maps/forest-ruins.json', import.meta.url),
      'utf8',
    ),
  );
  expect([level.width, level.height]).toEqual([512, 96]);
  expect(
    required(level.entities).filter((e) => e.type === 'checkpoint'),
  ).toHaveLength(4);
  for (const id of [4, 5, 6, 7, 8, 9, 11, 12, 13, 14])
    expect(level.tiles.some((row) => row.some((tile) => tile === id))).toBe(
      true,
    );
  const { run, inputs } = replayChallenge(MapValidator.playable(level));
  expect(run.state).toBe('completed');
  expect(run.falls).toBe(0);
  expect(run.checkpoint).toBe('checkpoint-4');
  expect(inputs.some((i) => i.down && i.jumpPressed)).toBe(true);
  expect(inputs.some((i) => i.sneak)).toBe(true);
  expect(inputs.some((i) => i.dashPressed)).toBe(true);
}, 15000);

it('ships four correctly ordered seamless atlas layers and keeps Night identical to legacy layers', () => {
  const names = ['sky', 'distant', 'midground', 'near'];
  for (const preset of ['night', 'day', 'rain']) {
    const atlas = PNG.sync.read(
      readFileSync(`public/assets/background-${preset}-atlas.png`),
    );
    for (let i = 0; i < 4; i++) {
      const original = PNG.sync.read(
        readFileSync(`public/assets/background-${names[i]}.png`),
      );
      for (let y = 0; y < 960; y++) {
        const left =
            ((Math.floor(i / 2) * 960 + y) * 2560 + (i % 2) * 1280) * 4,
          right = left + 1279 * 4;
        expect(
          atlas.data
            .subarray(left, left + 4)
            .equals(atlas.data.subarray(right, right + 4)),
        ).toBe(true);
        if (preset === 'night')
          expect(
            atlas.data
              .subarray(left, left + 1280 * 4)
              .equals(original.data.subarray(y * 1280 * 4, (y + 1) * 1280 * 4)),
          ).toBe(true);
      }
    }
  }
});
