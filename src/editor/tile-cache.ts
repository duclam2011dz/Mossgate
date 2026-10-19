import type { Assets } from '../infrastructure/assets.ts';
import type { DraftMap, Point } from '../domain/contracts.ts';
import { Dom } from '../infrastructure/dom.ts';
import { tiles } from '../domain/tiles.ts';
// Rasterize visible chunks at the current display density, bounded to 32 MiB.
export class EditorTileCache {
  assets: Assets;
  cache: Map<string, { canvas: HTMLCanvasElement; ids: Uint8Array }>;
  previousLevel: DraftMap | null;
  previousResolution: number;
  constructor(assets: Assets) {
    this.assets = assets;
    this.cache = new Map();
    this.previousLevel = null;
    this.previousResolution = 0;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    level: DraftMap,
    camera: Point,
    unit: number,
    width: number,
    height: number,
    ratio: number,
  ) {
    const resolution = Math.min(
        64,
        Math.max(8, 2 ** Math.ceil(Math.log2(unit * ratio))),
      ),
      side = 16 * resolution,
      limit = Math.max(
        8,
        Math.min(256, Math.floor((32 * 1024 * 1024) / (side * side * 4))),
      );
    if (
      this.previousLevel !== level ||
      this.previousResolution !== resolution
    ) {
      this.cache.clear();
      this.previousLevel = level;
      this.previousResolution = resolution;
    }
    const left = Math.max(0, Math.floor(camera.x / 16)),
      top = Math.max(0, Math.floor(camera.y / 16)),
      right = Math.min(
        Math.ceil(level.width / 16),
        Math.ceil((camera.x + width / unit) / 16),
      ),
      bottom = Math.min(
        Math.ceil(level.height / 16),
        Math.ceil((camera.y + height / unit) / 16),
      );
    for (let cy = top; cy < bottom; cy++)
      for (let cx = left; cx < right; cx++) {
        const key = `${cx},${cy}`;
        let entry = this.cache.get(key),
          matches = !!entry;
        if (entry)
          for (let y = 0; y < 16 && matches; y++)
            for (let x = 0; x < 16; x++)
              if (
                entry.ids[y * 16 + x] !==
                (level.tiles[cy * 16 + y]?.[cx * 16 + x] || 0)
              ) {
                matches = false;
                break;
              }
        if (!matches) {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = side;
          const chunk = Dom.context(canvas);
          chunk.imageSmoothingEnabled = false;
          const ids = new Uint8Array(256);
          for (let y = 0; y < 16; y++)
            for (let x = 0; x < 16; x++) {
              const id = level.tiles[cy * 16 + y]?.[cx * 16 + x] || 0;
              ids[y * 16 + x] = id;
              const image = this.assets[tiles[id]?.asset ?? ''];
              if (id && image)
                chunk.drawImage(
                  image,
                  x * resolution,
                  y * resolution,
                  resolution,
                  resolution,
                );
            }
          entry = { canvas, ids };
        }
        if (!entry) continue;
        this.cache.delete(key);
        this.cache.set(key, entry);
        while (this.cache.size > limit) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          this.cache.delete(oldest);
        }
        const x = Math.round((cx * 16 - camera.x) * unit),
          y = Math.round((cy * 16 - camera.y) * unit),
          w = Math.round((cx * 16 + 16 - camera.x) * unit) - x,
          h = Math.round((cy * 16 + 16 - camera.y) * unit) - y;
        ctx.drawImage(entry.canvas, x, y, w, h);
      }
  }
  dispose() {
    this.cache.clear();
  }
}
export const createEditorTileCache = (
  ...args: ConstructorParameters<typeof EditorTileCache>
) => new EditorTileCache(...args);
