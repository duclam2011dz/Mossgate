import { tiles } from '../domain/tiles.js';
// Rasterize visible chunks at the current display density, bounded to 32 MiB.
export class EditorTileCache {
  constructor(assets) {
    const self = this;
    self.assets = assets;
    self.cache = new Map();
    self.previousLevel = null;
    self.previousResolution = 0;
    Object.defineProperties(
      this,
      Object.getOwnPropertyDescriptors({
        draw(ctx, level, camera, unit, width, height, ratio) {
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
            self.previousLevel !== level ||
            self.previousResolution !== resolution
          ) {
            self.cache.clear();
            self.previousLevel = level;
            self.previousResolution = resolution;
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
              let entry = self.cache.get(key),
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
                const chunk = canvas.getContext('2d');
                chunk.imageSmoothingEnabled = false;
                const ids = new Uint8Array(256);
                for (let y = 0; y < 16; y++)
                  for (let x = 0; x < 16; x++) {
                    const id = level.tiles[cy * 16 + y]?.[cx * 16 + x] || 0;
                    ids[y * 16 + x] = id;
                    if (id)
                      chunk.drawImage(
                        self.assets[tiles[id].asset],
                        x * resolution,
                        y * resolution,
                        resolution,
                        resolution,
                      );
                  }
                entry = { canvas, ids };
              }
              self.cache.delete(key);
              self.cache.set(key, entry);
              while (self.cache.size > limit)
                self.cache.delete(self.cache.keys().next().value);
              const x = Math.round((cx * 16 - camera.x) * unit),
                y = Math.round((cy * 16 - camera.y) * unit),
                w = Math.round((cx * 16 + 16 - camera.x) * unit) - x,
                h = Math.round((cy * 16 + 16 - camera.y) * unit) - y;
              ctx.drawImage(entry.canvas, x, y, w, h);
            }
        },
        dispose() {
          self.cache.clear();
        },
      }),
    );
  }
}
export const createEditorTileCache = (...args) => new EditorTileCache(...args);
