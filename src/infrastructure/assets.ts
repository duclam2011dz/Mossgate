import { tiles } from '../domain/tiles.ts';
import { clips, effectNames } from '../shared/asset-definitions.ts';
export type Assets = Record<string, HTMLImageElement>;
export type AssetGroup = 'background' | 'editor' | 'game';
export const backgroundNames = ['sky', 'distant', 'midground', 'near'].map(
  (n) => `background-${n}`,
);
export const assetNames = [
  ...new Set([
    ...tiles
      .map((t) => t.asset)
      .filter((name): name is string => name !== null),
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
  static image(this: void, assets: Assets, name: string): HTMLImageElement {
    const image = assets[name];
    if (!image) throw new Error(`Missing loaded asset: ${name}`);
    return image;
  }
  cache = new Map<string, Promise<HTMLImageElement>>();
  async load(group: AssetGroup = 'game'): Promise<Assets> {
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
              new Promise<HTMLImageElement>((resolve, reject) => {
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
          const pending = this.cache.get(name);
          if (!pending) throw new Error(`Missing asset ${name}`);
          return [name, await pending] as const;
        }),
      ),
    );
  }
}
export const assetManager = new AssetManager();
export const loadAssets = (group?: AssetGroup) => assetManager.load(group);
