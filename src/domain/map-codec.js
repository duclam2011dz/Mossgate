import { tiles } from './tiles.js';
import { baseProperties, validatePatch, sparsePatch } from './properties.js';
import { validateEntities } from './entities.js';

export const limits = Object.freeze({
  minWidth: 16,
  minHeight: 12,
  maxWidth: 512,
  maxHeight: 128,
  maxBytes: 2 * 1024 * 1024,
});

export class MapCodec {
  static compactExtras(level) {
    const result = {},
      defaults = {};
    for (const id of Object.keys(level.tileDefaults || {}).sort(
      (a, b) => Number(a) - Number(b),
    )) {
      const patch = sparsePatch(Number(id), level.tileDefaults[id]);
      if (Object.keys(patch).length) defaults[id] = patch;
    }
    if (Object.keys(defaults).length) result.tileDefaults = defaults;
    const overrides = [];
    for (const key of Object.keys(level.cellOverrides || {}).sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number),
        [bx, by] = b.split(',').map(Number);
      return ay - by || ax - bx;
    })) {
      const [x, y] = key.split(',').map(Number),
        id = level.tiles[y]?.[x];
      if (!id) continue;
      const patch = sparsePatch(id, level.cellOverrides[key], {
        ...baseProperties(id),
        ...defaults[id],
      });
      if (Object.keys(patch).length) overrides.push([x, y, patch]);
    }
    if (overrides.length) result.cellOverrides = overrides;
    if (level.entities?.length)
      result.entities = validateEntities(
        level.entities,
        level.width,
        level.height,
      ).sort((a, b) => a.id.localeCompare(b.id));
    return result;
  }

  static decodeLevel(data) {
    const fail = (message) => {
      throw new Error(`Invalid map: ${message}`);
    };
    const tuple = (v, n) =>
      Array.isArray(v) && v.length === n && v.every(Number.isFinite);
    if (!data || ![1, 2, 3].includes(data.version)) fail('unsupported version');
    if (!tuple(data.size, 2) || !data.size.every(Number.isInteger))
      fail('size');
    const [width, height] = data.size;
    if (width < 16 || width > 512 || height < 12 || height > 128)
      fail('size must be 16..512 by 12..128');
    if (!Array.isArray(data.rects) || data.rects.length > width * height * 2)
      fail('rects');
    // Validate all bounds before allocating the decoded grid.
    for (const r of data.rects) {
      if (!tuple(r, 5) || !r.every(Number.isInteger)) fail('rectangle tuple');
      const [x, y, w, h, id] = r;
      if (
        x < 0 ||
        y < 0 ||
        w <= 0 ||
        h <= 0 ||
        x + w > width ||
        y + h > height ||
        !tiles[id] ||
        (data.version === 1 && id > 3) ||
        (data.version === 2 && id > 12)
      )
        fail('rectangle bounds or tile ID');
    }
    const within = (x, y, w, h) =>
      x >= 0 &&
      y >= 0 &&
      w > 0 &&
      h > 0 &&
      x + w <= width * 16 &&
      y + h <= height * 16;
    let spawn = null,
      portal = null;
    if (data.spawn !== null) {
      if (!tuple(data.spawn, 2) || !within(...data.spawn, 10, 14))
        fail('spawn bounds');
      spawn = { x: data.spawn[0], y: data.spawn[1] };
    } else if (data.version === 1) fail('spawn');
    if (data.portal !== null) {
      if (!tuple(data.portal, 4) || !within(...data.portal))
        fail('portal bounds');
      const [x, y, w, h] = data.portal;
      portal = { x, y, w, h };
    } else if (data.version === 1) fail('portal');
    if (!Number.isFinite(data.deathY) || data.deathY < height * 16)
      fail('deathY');
    const grid = Array.from({ length: height }, () => Array(width).fill(0));
    for (const [x, y, w, h, id] of data.rects)
      for (let row = y; row < y + h; row++) grid[row].fill(id, x, x + w);
    const level = {
      width,
      height,
      tiles: grid,
      spawn,
      portal,
      deathY: data.deathY,
    };
    if (data.version === 3) {
      const defaults = {},
        overrides = {};
      if (data.tileDefaults !== undefined) {
        if (
          !data.tileDefaults ||
          typeof data.tileDefaults !== 'object' ||
          Array.isArray(data.tileDefaults)
        )
          fail('tileDefaults');
        for (const [id, patch] of Object.entries(data.tileDefaults)) {
          if (!/^[1-9][0-9]*$/.test(id) || !tiles[Number(id)])
            fail('tileDefaults ID');
          defaults[id] = sparsePatch(Number(id), patch);
        }
      }
      if (data.cellOverrides !== undefined) {
        if (
          !Array.isArray(data.cellOverrides) ||
          data.cellOverrides.length > width * height
        )
          fail('cellOverrides');
        for (const item of data.cellOverrides) {
          if (!Array.isArray(item) || item.length !== 3)
            fail('cell override tuple');
          const [x, y, patch] = item;
          if (
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            x < 0 ||
            y < 0 ||
            x >= width ||
            y >= height ||
            !grid[y][x] ||
            Object.hasOwn(overrides, `${x},${y}`)
          )
            fail('cell override bounds');
          const id = grid[y][x];
          overrides[`${x},${y}`] = sparsePatch(id, patch, {
            ...baseProperties(id),
            ...defaults[id],
          });
        }
      }
      // Type-level edits must also be valid when combined with every instance patch.
      for (const [key, patch] of Object.entries(overrides)) {
        const [x, y] = key.split(',').map(Number);
        validatePatch(grid[y][x], patch, {
          ...baseProperties(grid[y][x]),
          ...defaults[grid[y][x]],
        });
      }
      if (Object.keys(defaults).length) level.tileDefaults = defaults;
      if (Object.keys(overrides).length) level.cellOverrides = overrides;
      if (data.entities !== undefined && data.entities.length)
        level.entities = validateEntities(data.entities, width, height);
      else if (data.entities !== undefined && !Array.isArray(data.entities))
        fail('entities');
    }

    return level;
  }
  static encodeLevel(level) {
    const rects = [],
      active = new Map();
    for (let y = 0; y < level.height; y++) {
      const next = new Map();
      for (let x = 0; x < level.width;) {
        const id = level.tiles[y][x],
          start = x;
        while (x < level.width && level.tiles[y][x] === id) x++;
        if (!id) continue;
        const key = `${start}:${x - start}:${id}`,
          prior = active.get(key);
        if (prior) {
          prior[3]++;
          next.set(key, prior);
        } else {
          const r = [start, y, x - start, 1, id];
          rects.push(r);
          next.set(key, r);
        }
      }
      active.clear();
      for (const [key, r] of next) active.set(key, r);
    }
    return {
      version: 3,
      size: [level.width, level.height],
      spawn: level.spawn ? [level.spawn.x, level.spawn.y] : null,
      portal: level.portal
        ? [level.portal.x, level.portal.y, level.portal.w, level.portal.h]
        : null,
      deathY: level.deathY,
      rects,
      ...MapCodec.compactExtras(level),
    };
  }
  static parseLevel(text, options) {
    if (new TextEncoder().encode(text).length > limits.maxBytes)
      throw new Error('Map exceeds the 2 MiB limit.');
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error('Could not open map. The file is not valid JSON.', {
        cause: error,
      });
    }
    try {
      return decodeLevel(data, options);
    } catch (error) {
      throw new Error(`Could not open map. ${error.message}`, { cause: error });
    }
  }
}
export const decodeLevel = MapCodec.decodeLevel;
export const encodeLevel = MapCodec.encodeLevel;
export const parseLevel = MapCodec.parseLevel;
