import {
  isEnemySpecies,
  enemyOverrideLimits,
  enemyDefinitions,
} from './enemy-definitions.ts';
import type { EnemyOverrides } from './contracts.ts';
import type {
  Point,
  Box,
  PointTuple,
  Entity,
  Saw,
  TileProperties,
} from './contracts.ts';
import { Guards } from '../shared/guards.ts';
// Swept point versus a rounded rectangle: strips plus corner circles.

export class EntitySystem {
  static segmentBox(this: void, a: Point, b: Point, box: Box) {
    let lo = 0,
      hi = 1;
    for (const axis of ['x', 'y'] as const) {
      const d = b[axis] - a[axis],
        min = box[axis],
        max = min + box[axis === 'x' ? 'w' : 'h'];
      if (Math.abs(d) < 1e-10) {
        if (a[axis] < min || a[axis] > max) return false;
      } else {
        let p = (min - a[axis]) / d,
          q = (max - a[axis]) / d;
        if (p > q) [p, q] = [q, p];
        lo = Math.max(lo, p);
        hi = Math.min(hi, q);
        if (lo > hi) return false;
      }
    }
    return true;
  }
  static validateEntities(
    this: void,
    raw: unknown,
    width: number,
    height: number,
  ): Entity[] {
    if (!Array.isArray(raw) || raw.length > 256)
      throw new Error('Invalid entities (maximum 256).');
    const ids = new Set<string>();
    let enemies = 0;
    const point = (p: unknown): p is PointTuple =>
      Guards.tuple2(p) &&
      p[0] >= 0 &&
      p[1] >= 0 &&
      p[0] <= width * 16 &&
      p[1] <= height * 16;
    return raw.map((value: unknown): Entity => {
      if (
        !Guards.record(value) ||
        typeof value.id !== 'string' ||
        !/^[-a-z0-9_]{1,64}$/i.test(value.id) ||
        ids.has(value.id)
      )
        throw new Error('Entity IDs must be unique.');
      ids.add(value.id);
      if (value.type === 'checkpoint') {
        if (
          !point(value.position) ||
          value.position[0] < 5 ||
          value.position[0] + 5 > width * 16 ||
          value.position[1] < 14
        )
          throw new Error('Invalid checkpoint position.');
        return {
          id: value.id,
          type: 'checkpoint',
          position: [...value.position],
        };
      }
      if (value.type === 'enemy') {
        if (
          ++enemies > 64 ||
          !isEnemySpecies(value.species) ||
          !point(value.spawn) ||
          (value.facing !== -1 && value.facing !== 1) ||
          !Array.isArray(value.patrol) ||
          value.patrol.length < 2 ||
          value.patrol.length > 16 ||
          !value.patrol.every(point)
        )
          throw new Error('Invalid enemy definition (maximum 64 enemies).');
        if (
          ['bramble-guard', 'spore-pod', 'root-charger'].includes(
            value.species,
          ) &&
          (value.patrol.length !== 2 ||
            value.patrol[0]?.[1] !== value.patrol[1]?.[1])
        )
          throw new Error('Ground patrol requires two horizontal endpoints.');
        const overrides: EnemyOverrides = {};
        if (value.overrides !== undefined) {
          if (!Guards.record(value.overrides))
            throw new Error('Invalid enemy overrides.');
          for (const [key, number] of Object.entries(value.overrides)) {
            if (!Object.hasOwn(enemyOverrideLimits, key))
              throw new Error('Unknown enemy override.');
            const name = key as keyof EnemyOverrides;
            const [min, max] = enemyOverrideLimits[name];
            if (!Guards.number(number) || number < min || number > max)
              throw new Error('Enemy override outside limits.');
            if (number !== enemyDefinitions[value.species][name])
              overrides[name] = number;
          }
        }
        return {
          id: value.id,
          type: 'enemy',
          species: value.species,
          spawn: [...value.spawn],
          facing: value.facing,
          patrol: structuredClone(value.patrol),
          ...(Object.keys(overrides).length ? { overrides } : {}),
        };
      }
      if (value.type !== 'saw') throw new Error('Unsupported entity type.');
      const { path, mode, speed, radius, phase } = value;
      if (
        !Array.isArray(path) ||
        path.length < 2 ||
        path.length > 32 ||
        !path.every(point) ||
        !path.every((p) => p.every((n) => n % 16 === 0)) ||
        (mode !== 'loop' && mode !== 'ping-pong') ||
        !Guards.number(speed) ||
        speed < 16 ||
        speed > 240 ||
        !Guards.number(radius) ||
        radius < 4 ||
        radius > 12 ||
        !Guards.number(phase) ||
        phase < 0 ||
        phase > 1
      )
        throw new Error('Invalid saw path or properties.');
      if (
        path.some(
          (p) =>
            p[0] < radius ||
            p[1] < radius ||
            p[0] + radius > width * 16 ||
            p[1] + radius > height * 16,
        )
      )
        throw new Error('Saw radius extends outside map.');
      const filtered = path.filter((p, i) => {
        const previous = path[i - 1];
        return !previous || p[0] !== previous[0] || p[1] !== previous[1];
      });
      if (filtered.length < 2) throw new Error('Saw needs a nonzero path.');
      return {
        id: value.id,
        type: 'saw',
        path: structuredClone(filtered),
        mode,
        speed,
        radius,
        phase,
      };
    });
  }
  static sawPosition(this: void, entity: Saw, time: number): Point {
    const first = entity.path[0];
    if (!first) throw new Error('Saw needs a nonzero path.');
    const path = entity.mode === 'loop' ? [...entity.path, first] : entity.path;
    const lengths = path.slice(1).map((p, i) => {
        const previous = path[i];
        return previous
          ? Math.hypot(p[0] - previous[0], p[1] - previous[1])
          : 0;
      }),
      total = lengths.reduce((a, b) => a + b, 0);
    if (!total) return { x: first[0], y: first[1] };
    const period = entity.mode === 'loop' ? total : 2 * total;
    let distance =
      (((time * entity.speed + entity.phase * period) % period) + period) %
      period;
    if (distance > total) distance = period - distance;
    for (let i = 0; i < lengths.length; i++) {
      const length = lengths[i] ?? 0,
        a = path[i],
        b = path[i + 1];
      if (!a || !b) continue;
      if (distance <= length || i === lengths.length - 1) {
        const f = length ? distance / length : 0;
        return {
          x: a[0] + (b[0] - a[0]) * f,
          y: a[1] + (b[1] - a[1]) * f,
        };
      }
      distance -= length;
    }
    return { x: first[0], y: first[1] };
  }
  static circleBox(this: void, circle: Point, radius: number, box: Box) {
    return (
      (circle.x - Math.max(box.x, Math.min(box.x + box.w, circle.x))) ** 2 +
        (circle.y - Math.max(box.y, Math.min(box.y + box.h, circle.y))) ** 2 <
      radius ** 2
    );
  }
  static sweptSaw(
    this: void,
    a: Point,
    b: Point,
    radius: number,
    oldBox: Box,
    newBox: Box,
  ) {
    radius -= 1e-6;
    const start = { x: a.x - oldBox.x, y: a.y - oldBox.y },
      end = { x: b.x - newBox.x, y: b.y - newBox.y },
      w = oldBox.w,
      h = oldBox.h;
    if (
      segmentBox(start, end, { x: -radius, y: 0, w: w + radius * 2, h }) ||
      segmentBox(start, end, { x: 0, y: -radius, w, h: h + radius * 2 })
    )
      return true;
    const dx = end.x - start.x,
      dy = end.y - start.y,
      length = dx * dx + dy * dy;
    for (const [x, y] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ] satisfies PointTuple[]) {
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / length),
          )
        : 0;
      if (
        (start.x + t * dx - x) ** 2 + (start.y + t * dy - y) ** 2 <
        radius ** 2
      )
        return true;
    }
    return false;
  }
  static spikePhase(
    this: void,
    props: Pick<
      TileProperties,
      'safeTime' | 'warningTime' | 'activeTime' | 'phase'
    >,
    time: number,
  ) {
    const cycle = props.safeTime + props.warningTime + props.activeTime,
      t = (time + props.phase * cycle) % cycle;
    return t < props.safeTime
      ? 'retracted'
      : t < props.safeTime + props.warningTime
        ? 'warning'
        : 'active';
  }
}
export const validateEntities = EntitySystem.validateEntities;
export const sawPosition = EntitySystem.sawPosition;
export const circleBox = EntitySystem.circleBox;
export const sweptSaw = EntitySystem.sweptSaw;
export const spikePhase = EntitySystem.spikePhase;

const segmentBox = EntitySystem.segmentBox;
