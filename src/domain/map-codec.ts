import type {
  DraftMap,
  WireMap,
  PropertyPatch,
  RectangleTuple,
  TileId,
} from './contracts.ts';
import { Guards } from '../shared/guards.ts';
import { tiles } from './tiles.ts';
import { baseProperties, validatePatch, sparsePatch } from './properties.ts';
import { validateEntities } from './entities.ts';

export const limits = Object.freeze({
  minWidth: 16,
  minHeight: 12,
  maxWidth: 512,
  maxHeight: 128,
  maxBytes: 2 * 1024 * 1024,
});

export class MapCodec {
  static compactExtras(
    this: void,
    level: DraftMap,
  ): Pick<WireMap, 'tileDefaults' | 'cellOverrides' | 'entities'> {
    const result: Pick<WireMap, 'tileDefaults' | 'cellOverrides' | 'entities'> =
        {},
      defaults: Record<string, PropertyPatch> = {};
    for (const id of Object.keys(level.tileDefaults || {}).sort(
      (a, b) => Number(a) - Number(b),
    )) {
      const patch = sparsePatch(Number(id), level.tileDefaults?.[id]);
      if (Object.keys(patch).length) defaults[id] = patch;
    }
    if (Object.keys(defaults).length) result.tileDefaults = defaults;
    const overrides: [number, number, PropertyPatch][] = [];
    for (const key of Object.keys(level.cellOverrides || {}).sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number),
        [bx, by] = b.split(',').map(Number);
      return (ay ?? 0) - (by ?? 0) || (ax ?? 0) - (bx ?? 0);
    })) {
      const [x, y] = key.split(',').map(Number),
        id = level.tiles[y ?? -1]?.[x ?? -1];
      if (!id || x === undefined || y === undefined) continue;
      const patch = sparsePatch(id, level.cellOverrides?.[key], {
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

  static decodeLevel(
    this: void,
    data: unknown,
    _options?: { draft?: boolean },
  ): DraftMap {
    void _options;
    const fail = (message: string): never => {
      throw new Error(`Invalid map: ${message}`);
    };
    if (
      !Guards.record(data) ||
      typeof data.version !== 'number' ||
      ![1, 2, 3, 4, 5].includes(data.version)
    )
      return fail('unsupported version');
    if (!Guards.tuple2(data.size) || !data.size.every(Number.isInteger))
      return fail('size');
    const [width, height] = data.size;
    if (width < 16 || width > 512 || height < 12 || height > 128)
      fail('size must be 16..512 by 12..128');
    if (!Array.isArray(data.rects) || data.rects.length > width * height * 2)
      return fail('rects');
    // Validate all bounds before allocating the decoded grid.
    for (const r of data.rects) {
      if (!Guards.tuple5(r) || !r.every(Number.isInteger))
        return fail('rectangle tuple');
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
    const within = (x: number, y: number, w: number, h: number) =>
      x >= 0 &&
      y >= 0 &&
      w > 0 &&
      h > 0 &&
      x + w <= width * 16 &&
      y + h <= height * 16;
    let spawn = null,
      portal = null;
    if (data.spawn !== null) {
      if (!Guards.tuple2(data.spawn) || !within(...data.spawn, 10, 14))
        return fail('spawn bounds');
      spawn = { x: data.spawn[0], y: data.spawn[1] };
    } else if (data.version === 1) fail('spawn');
    if (data.portal !== null) {
      if (!Guards.tuple4(data.portal) || !within(...data.portal))
        return fail('portal bounds');
      const [x, y, w, h] = data.portal;
      portal = { x, y, w, h };
    } else if (data.version === 1) fail('portal');
    if (!Guards.number(data.deathY) || data.deathY < height * 16)
      return fail('deathY');
    const grid = Array.from({ length: height }, () =>
      Array<TileId>(width).fill(0),
    );
    // Rectangle shape, bounds and registry membership were validated before allocation.
    for (const [x, y, w, h, id] of data.rects as RectangleTuple[])
      for (let row = y; row < y + h; row++) grid[row]?.fill(id, x, x + w);
    const level: DraftMap = {
      width,
      height,
      tiles: grid,
      spawn,
      portal,
      deathY: data.deathY,
    };
    if (data.version === 3 || data.version === 4 || data.version === 5) {
      const defaults: Record<string, PropertyPatch> = {},
        overrides: Record<string, PropertyPatch> = {};
      if (data.tileDefaults !== undefined) {
        if (
          !data.tileDefaults ||
          typeof data.tileDefaults !== 'object' ||
          Array.isArray(data.tileDefaults)
        )
          return fail('tileDefaults');
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
          return fail('cellOverrides');
        for (const item of data.cellOverrides) {
          if (!Array.isArray(item) || item.length !== 3)
            return fail('cell override tuple');
          const x: unknown = item[0],
            y: unknown = item[1],
            patch: unknown = item[2];
          if (
            !Guards.number(x) ||
            !Number.isInteger(x) ||
            !Guards.number(y) ||
            !Number.isInteger(y) ||
            x < 0 ||
            y < 0 ||
            x >= width ||
            y >= height ||
            !grid[y]?.[x] ||
            Object.hasOwn(overrides, `${x},${y}`)
          )
            return fail('cell override bounds');
          const id = grid[y]?.[x];
          if (!id) return fail('cell override bounds');
          overrides[`${x},${y}`] = sparsePatch(id, patch, {
            ...baseProperties(id),
            ...defaults[id],
          });
        }
      }
      // Type-level edits must also be valid when combined with every instance patch.
      for (const [key, patch] of Object.entries(overrides)) {
        const [x, y] = key.split(',').map(Number);
        const id = grid[y ?? -1]?.[x ?? -1];
        if (!id) return fail('cell override bounds');
        validatePatch(id, patch, { ...baseProperties(id), ...defaults[id] });
      }
      if (Object.keys(defaults).length) level.tileDefaults = defaults;
      if (Object.keys(overrides).length) level.cellOverrides = overrides;
      if (data.entities !== undefined) {
        const entities = validateEntities(data.entities, width, height);
        if (
          data.version !== 5 &&
          entities.some((entity) => entity.type === 'enemy')
        )
          return fail('enemy entities require version 5');
        if (entities.length) level.entities = entities;
      }
    }

    if (data.version === 4 || data.version === 5) {
      const b = data.background;
      if (
        !Guards.record(b) ||
        (b.preset !== 'night' && b.preset !== 'day' && b.preset !== 'rain') ||
        typeof b.image !== 'string' ||
        !/^\.\/[a-zA-Z0-9_-]+\.png$/.test(b.image)
      )
        return fail('background');
      level.background = { preset: b.preset, image: b.image };
    }
    level.background ??= { preset: 'night', image: './background.png' };
    return level;
  }
  static encodeLevel(this: void, level: DraftMap): WireMap {
    const rects: RectangleTuple[] = [],
      active = new Map<string, RectangleTuple>();
    for (let y = 0; y < level.height; y++) {
      const next = new Map<string, RectangleTuple>();
      for (let x = 0; x < level.width;) {
        const id = level.tiles[y]?.[x] ?? 0,
          start = x;
        while (x < level.width && (level.tiles[y]?.[x] ?? 0) === id) x++;
        if (!id) continue;
        const key = `${start}:${x - start}:${id}`,
          prior = active.get(key);
        if (prior) {
          prior[3]++;
          next.set(key, prior);
        } else {
          const r: RectangleTuple = [start, y, x - start, 1, id];
          rects.push(r);
          next.set(key, r);
        }
      }
      active.clear();
      for (const [key, r] of next) active.set(key, r);
    }
    return {
      version: 5,
      background: {
        preset: level.background?.preset ?? 'night',
        image: './background.png',
      },
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
  static parseLevel(this: void, text: string, options?: { draft?: boolean }) {
    if (new TextEncoder().encode(text).length > limits.maxBytes)
      throw new Error('Map exceeds the 2 MiB limit.');
    let data: unknown;
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
      throw new Error(`Could not open map. ${Guards.error(error)}`, {
        cause: error,
      });
    }
  }
}
export const decodeLevel = MapCodec.decodeLevel;
export const encodeLevel = MapCodec.encodeLevel;
export const parseLevel = MapCodec.parseLevel;
