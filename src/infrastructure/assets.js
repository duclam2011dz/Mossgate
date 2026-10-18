import { tiles } from '../domain/tiles.js';
import { clips, effectNames } from '../shared/asset-definitions.js';
export const backgroundNames = ['sky', 'distant', 'midground', 'near'].map(
  (n) => `background-${n}`,
);
export const assetNames = [
  ...new Set([
    ...tiles.map((t) => t.asset).filter(Boolean),
    'player',
    'portal',
    'background',
    ...backgroundNames,
    'timed-spikes-retracted',
    'timed-spikes-warning',
    'trap-crumble',
    'saw',
    'entity-saw',
    'checkpoint',
    'checkpoint-active',
    ...Object.keys(clips).map((n) => `player-${n}`),
    ...effectNames.map((n) => `effect-${n}`),
  ]),
];
export class AssetManager {
  constructor() {
    this.cache = new Map();
  }
  async load(group = 'game') {
    const names =
      group === 'background'
        ? backgroundNames
        : group === 'editor'
          ? assetNames.filter(
              (n) => !n.startsWith('effect-') && !n.startsWith('player-'),
            )
          : assetNames;
    return Object.fromEntries(
      await Promise.all(
        names.map(async (name) => {
          if (!this.cache.has(name))
            this.cache.set(
              name,
              new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => {
                  this.cache.delete(name);
                  reject(
                    new Error(
                      `Could not load ${name}.png. Reload to try again.`,
                    ),
                  );
                };
                img.src = `${import.meta.env.BASE_URL}assets/${name}.png`;
              }),
            );
          return [name, await this.cache.get(name)];
        }),
      ),
    );
  }
}
export const assetManager = new AssetManager();
export const loadAssets = (group) => assetManager.load(group);
