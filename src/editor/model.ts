import {
  entityAnchor,
  entityFits,
  translateEntity,
} from '../domain/entity-geometry.ts';
import type { Entity } from '../domain/contracts.ts';
import type {
  DraftMap,
  Box,
  Point,
  TileId,
  PropertyPatch,
} from '../domain/contracts.ts';
export interface Clipboard {
  w: number;
  h: number;
  cells: TileId[][];
  overrides: Record<string, PropertyPatch>;
  entities?: Entity[];
}
type Metadata = Omit<DraftMap, 'tiles'>;
type CommandBase = {
  changes: [number, TileId, TileId][];
  from: number;
  to: number;
  cost: number;
};
export type EditorCommand = CommandBase &
  (
    | { resized: true; before: DraftMap; after: DraftMap }
    | { resized: false; before: Metadata; after: Metadata }
  );
import { encodeLevel } from '../domain/map-codec.ts';
import { invalidateProperties } from '../domain/properties.ts';

export class EditorModel {
  level: DraftMap;
  history: EditorCommand[];
  future: EditorCommand[];
  revision: number;
  serial: number;
  saved: number;
  pending: DraftMap | null;
  constructor(level: DraftMap = blankLevel()) {
    this.level = structuredClone(level);
    this.history = [];
    this.future = [];
    this.revision = 0;
    this.serial = 0;
    this.saved = 0;
    this.pending = null;
  }
  get dirty() {
    return this.revision !== this.saved;
  }
  begin() {
    if (!this.pending) this.pending = structuredClone(this.level);
  }
  commit() {
    if (!this.pending) return false;
    const before = this.pending,
      after = this.level;
    this.pending = null;
    const resized =
        before.width !== after.width || before.height !== after.height,
      changes: [number, TileId, TileId][] = [];
    if (!resized)
      for (let y = 0; y < after.height; y++)
        for (let x = 0; x < after.width; x++)
          if ((before.tiles[y]?.[x] ?? 0) !== (after.tiles[y]?.[x] ?? 0))
            changes.push([
              y * after.width + x,
              before.tiles[y]?.[x] ?? 0,
              after.tiles[y]?.[x] ?? 0,
            ]);
    const meta = (l: DraftMap): Metadata =>
      structuredClone({
        ...(l.background ? { background: l.background } : {}),
        width: l.width,
        height: l.height,
        spawn: l.spawn,
        portal: l.portal,
        deathY: l.deathY,
        ...(l.tileDefaults ? { tileDefaults: l.tileDefaults } : {}),
        ...(l.cellOverrides ? { cellOverrides: l.cellOverrides } : {}),
        ...(l.entities ? { entities: l.entities } : {}),
      });
    if (
      !resized &&
      !changes.length &&
      JSON.stringify(meta(before)) === JSON.stringify(meta(after))
    )
      return false;
    const shared = {
      changes,
      from: this.revision,
      to: ++this.serial,
      cost: resized
        ? before.width * before.height + after.width * after.height
        : changes.length,
    };
    const command: EditorCommand = resized
      ? { ...shared, resized: true, before, after: structuredClone(after) }
      : { ...shared, resized: false, before: meta(before), after: meta(after) };
    command.cost +=
      Object.keys(before.cellOverrides || {}).length +
      Object.keys(after.cellOverrides || {}).length +
      (before.entities?.length || 0) +
      (after.entities?.length || 0);
    invalidateProperties(this.level);
    this.history.push(command);
    this.future = [];
    this.revision = command.to;
    while (
      this.history.length > 100 ||
      this.history.reduce((n, c) => n + c.cost, 0) > 1000000
    )
      this.history.shift();
    return true;
  }
  cancel() {
    if (this.pending) {
      this.level = this.pending;
      invalidateProperties(this.level);
      this.pending = null;
    }
  }
  apply(command: EditorCommand, forward: boolean) {
    if (command.resized)
      this.level = structuredClone(forward ? command.after : command.before);
    else {
      const meta = forward ? command.after : command.before;
      for (const key of [
        'tileDefaults',
        'cellOverrides',
        'entities',
        'background',
      ] as const)
        delete this.level[key];
      Object.assign(this.level, structuredClone(meta));
      for (const [index, before, after] of command.changes) {
        const row = this.level.tiles[Math.floor(index / this.level.width)];
        if (row) row[index % this.level.width] = forward ? after : before;
      }
    }
    invalidateProperties(this.level);
    this.revision = forward ? command.to : command.from;
  }
  undo() {
    this.cancel();
    const c = this.history.pop();
    if (c) {
      this.apply(c, false);
      this.future.push(c);
    }
  }
  redo() {
    this.cancel();
    const c = this.future.pop();
    if (c) {
      this.apply(c, true);
      this.history.push(c);
    }
  }
  set(x: number, y: number, id: TileId) {
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height)
      return;
    const row = this.level.tiles[y];
    if (row && row[x] !== id) {
      if (this.level.cellOverrides)
        delete this.level.cellOverrides[`${x},${y}`];
      row[x] = id;
    }
  }
  line(a: Point, b: Point, id: TileId) {
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let i = 0; i <= steps; i++)
      this.set(
        Math.round(a.x + ((b.x - a.x) * i) / steps),
        Math.round(a.y + ((b.y - a.y) * i) / steps),
        id,
      );
  }
  rectangle(a: Point, b: Point, id: TileId) {
    for (
      let y = Math.max(0, Math.min(a.y, b.y));
      y <= Math.min(this.level.height - 1, Math.max(a.y, b.y));
      y++
    )
      for (
        let x = Math.max(0, Math.min(a.x, b.x));
        x <= Math.min(this.level.width - 1, Math.max(a.x, b.x));
        x++
      )
        this.set(x, y, id);
  }
  fill(x: number, y: number, id: TileId) {
    const l = this.level;
    if (x < 0 || y < 0 || x >= l.width || y >= l.height) return;
    const original = l.tiles[y]?.[x];
    if (original === id) return;
    const stack = [y * l.width + x];
    this.set(x, y, id);
    while (stack.length) {
      const index = stack.pop();
      if (index === undefined) break;
      const cx = index % l.width,
        cy = Math.floor(index / l.width);
      for (const [nx, ny] of [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ] satisfies [number, number][])
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < l.width &&
          ny < l.height &&
          l.tiles[ny]?.[nx] === original
        ) {
          this.set(nx, ny, id);
          stack.push(ny * l.width + nx);
        }
    }
  }
  copy(region: Box): Clipboard {
    return {
      entities: (this.level.entities ?? [])
        .filter((entity) => {
          const [x, y] = entityAnchor(entity);
          return (
            x >= region.x * 16 &&
            y >= region.y * 16 &&
            x < (region.x + region.w) * 16 &&
            y < (region.y + region.h) * 16
          );
        })
        .map((entity) =>
          translateEntity(entity, -region.x * 16, -region.y * 16),
        ),
      w: region.w,
      h: region.h,
      overrides: Object.fromEntries(
        Object.entries(this.level.cellOverrides || {})
          .filter(([key]) => {
            const [x = -1, y = -1] = key.split(',').map(Number);
            return (
              x >= region.x &&
              y >= region.y &&
              x < region.x + region.w &&
              y < region.y + region.h
            );
          })
          .map(([key, patch]) => {
            const [x = -1, y = -1] = key.split(',').map(Number);
            return [`${x - region.x},${y - region.y}`, structuredClone(patch)];
          }),
      ),
      cells: Array.from({ length: region.h }, (_, y) =>
        Array.from(
          { length: region.w },
          (_, x) => this.level.tiles[y + region.y]?.[x + region.x] || 0,
        ),
      ),
    };
  }
  removeRegionEntities(region: Box) {
    this.level.entities = (this.level.entities ?? []).filter((entity) => {
      const [x, y] = entityAnchor(entity);
      return !(
        x >= region.x * 16 &&
        y >= region.y * 16 &&
        x < (region.x + region.w) * 16 &&
        y < (region.y + region.h) * 16
      );
    });
  }
  paste(data: Clipboard, x: number, y: number, preserveIds = false) {
    let skipped = 0;
    const entities = (this.level.entities ??= []);
    for (const source of data.entities ?? []) {
      const entity = translateEntity(source, x * 16, y * 16);
      if (
        !entityFits(entity, this.level.width, this.level.height) ||
        entities.length >= 256 ||
        (entity.type === 'enemy' &&
          entities.filter((e) => e.type === 'enemy').length >= 64)
      ) {
        skipped++;
        continue;
      }
      if (!preserveIds) {
        let suffix = 1;
        const prefix = source.id.slice(0, 48);
        while (entities.some((e) => e.id === `${prefix}-copy-${suffix}`))
          suffix++;
        entity.id = `${prefix}-copy-${suffix}`;
      }
      if (entities.some((e) => e.id === entity.id)) {
        skipped++;
        continue;
      }
      entities.push(entity);
    }
    for (let row = 0; row < data.h; row++)
      for (let col = 0; col < data.w; col++) {
        const tx = x + col,
          ty = y + row;
        if (
          tx < 0 ||
          ty < 0 ||
          tx >= this.level.width ||
          ty >= this.level.height
        )
          continue;
        this.set(tx, ty, data.cells[row]?.[col] ?? 0);
        const key = `${tx},${ty}`,
          patch = data.overrides?.[`${col},${row}`];
        if (patch) {
          this.level.cellOverrides ||= {};
          this.level.cellOverrides[key] = structuredClone(patch);
        } else if (this.level.cellOverrides)
          delete this.level.cellOverrides[key];
      }
    return skipped;
  }
  resize(width: number, height: number) {
    const old = this.level;
    this.level = {
      ...old,
      width,
      height,
      tiles: Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => old.tiles[y]?.[x] || 0),
      ),
      deathY: height * 16 + 64,
    };
    let removed = false;
    for (const [name, w, h] of [
      ['spawn', 10, 14],
      ['portal', old.portal?.w || 20, old.portal?.h || 32],
    ] satisfies ['spawn' | 'portal', number, number][]) {
      const marker = this.level[name];
      if (marker && (marker.x + w > width * 16 || marker.y + h > height * 16)) {
        this.level[name] = null;
        removed = true;
      }
    }
    if (this.level.cellOverrides)
      this.level.cellOverrides = Object.fromEntries(
        Object.entries(this.level.cellOverrides).filter(([key]) => {
          const [x = -1, y = -1] = key.split(',').map(Number);
          return x < width && y < height;
        }),
      );
    if (this.level.entities) {
      const before = this.level.entities.length;
      this.level.entities = this.level.entities.filter((entity) =>
        entityFits(entity, width, height),
      );
      removed ||= before !== this.level.entities.length;
    }
    return removed;
  }
  export() {
    return JSON.stringify(encodeLevel(this.level));
  }
}

export class EditorGeometry {
  static blankLevel(this: void, width = 160, height = 40): DraftMap {
    return {
      background: { preset: 'night', image: './background.png' },
      width,
      height,
      tiles: Array.from({ length: height }, () => Array<TileId>(width).fill(0)),
      spawn: null,
      portal: null,
      deathY: height * 16 + 64,
    };
  }
  static screenCell(
    this: void,
    clientX: number,
    clientY: number,
    bounds: { left: number; top: number },
    camera: Point,
    zoom: number,
  ) {
    const unit = 32 * zoom;
    return {
      x: Math.floor((clientX - bounds.left) / unit + camera.x),
      y: Math.floor((clientY - bounds.top) / unit + camera.y),
    };
  }
}
export const blankLevel = EditorGeometry.blankLevel;
export const screenCell = EditorGeometry.screenCell;
