import { EnemyGenerator } from './assets/enemies.ts';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { clips, effectNames } from '../src/shared/asset-definitions.ts';
import { TerrainGenerator } from './assets/terrain.ts';
import { PlayerGenerator } from './assets/player.ts';
import { EffectsGenerator } from './assets/effects.ts';
import { BackgroundGenerator } from './assets/background.ts';
import { EntityGenerator } from './assets/entities.ts';
export const assetManifest = {
  version: 4,
  enemies: {
    species: [
      'bramble-guard',
      'spore-pod',
      'root-charger',
      'thorn-wisp',
      'vine-moth',
      'bloom-sentinel',
    ],
    states: ['idle', 'move', 'alert', 'windup', 'attack', 'recover'],
    frames: 12,
    fps: 24,
    width: 64,
    height: 64,
  },
  atlases: ['night', 'day', 'rain'].map((preset) => ({
    preset,
    file: `background-${preset}-atlas.png`,
    width: 2560,
    height: 1920,
  })),
  backgrounds: ['sky', 'distant', 'midground', 'near'].map((name) => ({
    file: `background-${name}.png`,
    width: 1280,
    height: 960,
  })),
  traps: {
    crumble: {
      file: 'trap-crumble.png',
      frames: 12,
      fps: 24,
      width: 64,
      height: 64,
    },
    saw: { file: 'entity-saw.png', frames: 12, fps: 24, width: 64, height: 64 },
  },
  player: Object.fromEntries(
    Object.entries(clips).map(([name, clip]) => [
      name,
      { ...clip, file: `player-${name}.png`, fps: 24, width: 64, height: 64 },
    ]),
  ),
  effects: Object.fromEntries(
    effectNames.map((name) => [
      name,
      {
        file: `effect-${name}.png`,
        frames: 12,
        fps: 24,
        loop: false,
        width: 32,
        height: 32,
      },
    ]),
  ),
};
export function generateAssets() {
  return Object.fromEntries(
    Object.entries({
      ...TerrainGenerator.generate(),
      ...PlayerGenerator.generate(),
      ...EffectsGenerator.generate(),
      ...BackgroundGenerator.generate(),
      ...EntityGenerator.generate(),
      ...EnemyGenerator.generate(),
    }).map(([name, png]) => [name, PNG.sync.write(png)]),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const folder = new URL('../public/assets/', import.meta.url);
  mkdirSync(folder, { recursive: true });
  const assets = generateAssets();
  for (const [name, data] of Object.entries(assets))
    writeFileSync(new URL(`${name}.png`, folder), data);
  writeFileSync(
    new URL('manifest.json', folder),
    JSON.stringify(assetManifest),
  );
  process.stdout.write(
    `Generated ${Object.keys(assets).length} deterministic PNG assets and manifest.\n`,
  );
}
