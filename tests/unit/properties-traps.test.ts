import { required } from '../helpers/required.ts';
import type { PlayableMap, Saw, TileId } from '../../src/domain/contracts.ts';
import { describe, it, expect } from 'vitest';
import {
  resolveProperties,
  baseProperties,
  validatePatch,
  invalidateProperties,
} from '../../src/domain/properties.ts';
import { decodeLevel, encodeLevel } from '../../src/domain/map-codec.ts';
import { playErrors } from '../../src/simulation/map-validator.ts';
import {
  createRun,
  step,
  emptyInput,
} from '../../src/simulation/game-simulation.ts';
import { EditorModel } from '../../src/editor/model.ts';
import {
  sawPosition,
  sweptSaw,
  spikePhase,
  validateEntities,
} from '../../src/domain/entities.ts';
import { updateTraps } from '../../src/simulation/traps.ts';
import { level as legacy } from '../helpers/level.ts';
const world = (): PlayableMap => ({
  width: 32,
  height: 20,
  tiles: Array.from({ length: 20 }, (_, y) =>
    Array<TileId>(32).fill(y >= 10 ? 1 : 0),
  ),
  spawn: { x: 32, y: 146 },
  portal: { x: 480, y: 128, w: 20, h: 32 },
  deathY: 400,
});
describe('effective properties and v3', () => {
  it('merges registry, type and cell overrides without mutating global defaults', () => {
    const l = world();
    required(l.tiles[10])[2] = 4;
    l.tileDefaults = { 4: { friction: 0, speed: 0.7 } };
    l.cellOverrides = { '2,10': { speed: 0 } };
    const p = resolveProperties(l, 4, 2, 10);
    expect(p.speed).toBe(0);
    expect(p.friction).toBe(0);
    expect(p.acceleration).toBe(0.2);
    expect(baseProperties(4).speed).toBe(1);
    required(l.tileDefaults[4]).friction = 0.5;
    invalidateProperties(l);
    expect(resolveProperties(l, 4, 2, 10).friction).toBe(0.5);
  });
  it('honors zero speed, acceleration, friction and disabled dash breaking', () => {
    const l = world(),
      r = createRun(l);
    l.tileDefaults = { 1: { speed: 0, acceleration: 0, friction: 0 } };
    r.player.vx = 40;
    step(r, l, { ...emptyInput(), axis: 1 });
    expect(r.player.vx).toBe(40);
    required(l.tiles[9])[4] = 11;
    l.cellOverrides = { '4,9': { breakable: false } };
    invalidateProperties(l);
    r.player.x = 48;
    step(r, l, { ...emptyInput(), dashPressed: true });
    for (let i = 0; i < 6; i++) step(r, l, emptyInput());
    expect(r.broken.size).toBe(0);
    expect(r.player.x).toBe(54);
  });
  it.each([
    { width: 0 },
    { offsetX: 15, width: 2 },
    { offsetY: 0.25 },
    { kind: 'hazard' },
    { effectsColor: 'red' },
    { effectsIntensity: 3 },
  ])('rejects invalid patches %j', (patch) =>
    expect(() => validatePatch(4, patch)).toThrow(),
  );
  it('encodes sparse overrides and entities, round trips legacy geometry', () => {
    const l = structuredClone(legacy);
    l.tileDefaults = { 4: { friction: 0.2, speed: 0.5 } };
    required(l.tiles[30])[1] = 4;
    l.cellOverrides = { '1,30': { speed: 0.5, friction: 0 } };
    l.entities = [{ id: 'flag', type: 'checkpoint', position: [56, 480] }];
    const data = encodeLevel(l);
    expect(data.version).toBe(5);
    expect(required(data.tileDefaults)[4]).toEqual({ speed: 0.5 });
    expect(required(data.cellOverrides)[0]).toEqual([1, 30, { friction: 0 }]);
    const result = decodeLevel(data);
    expect(resolveProperties(result, 4, 1, 30).friction).toBe(0);
    expect(required(required(result.entities)[0]).id).toBe('flag');
  });
  it('rejects overrides on empty cells and unknown IDs or properties', () => {
    const d = encodeLevel(legacy);
    d.cellOverrides = [[0, 0, { speed: 1 }]];
    expect(() => decodeLevel(d)).toThrow();
    d.cellOverrides = [];
    const invalid: unknown = { ...d, tileDefaults: { 4: { unknown: 1 } } };
    expect(() => decodeLevel(invalid)).toThrow();
  });
  it('property changes are undoable and follow copy/paste/erase/resize', () => {
    const m = new EditorModel(legacy);
    m.begin();
    m.level.cellOverrides = { '1,30': { speed: 0.2 } };
    m.commit();
    expect(m.dirty).toBe(true);
    m.undo();
    expect(m.level.cellOverrides).toBeUndefined();
    m.redo();
    expect(required(m.level.cellOverrides['1,30']).speed).toBe(0.2);
    const data = m.copy({ x: 1, y: 30, w: 1, h: 1 });
    m.begin();
    m.paste(data, 3, 30);
    m.commit();
    expect(required(m.level.cellOverrides['3,30']).speed).toBe(0.2);
    m.begin();
    m.set(3, 30, 4);
    m.commit();
    expect(m.level.cellOverrides['3,30']).toBeUndefined();
    m.undo();
    expect(required(m.level.cellOverrides['3,30']).speed).toBe(0.2);
  });
  it('custom hitbox changes actual collision and one-way drop clearance', () => {
    const l = world(),
      r = createRun(l);
    required(l.tiles[10])[2] = 8;
    l.cellOverrides = { '2,10': { height: 8, offsetY: 4 } };
    r.player.y = 150;
    step(r, l, emptyInput());
    expect(r.player.grounded).toBe(true);
    step(r, l, { ...emptyInput(), jumpPressed: true, down: true });
    expect(r.player.dropKey).not.toBeNull();
    for (let i = 0; i < 20; i++) step(r, l, emptyInput());
    expect(r.player.dropKey).toBeNull();
  });
});
describe('timed traps and checkpoints', () => {
  it('timed spikes share precise visible phases and only active kills', () => {
    const props = { safeTime: 1.2, warningTime: 0.4, activeTime: 1, phase: 0 };
    expect(spikePhase(props, 0)).toBe('retracted');
    expect(spikePhase(props, 1.2)).toBe('warning');
    expect(spikePhase(props, 1.61)).toBe('active');
    const l = world(),
      r = createRun(l);
    required(l.tiles[9])[2] = 13;
    step(r, l, emptyInput());
    expect(r.falls).toBe(0);
    r.trapTime = 1.61;
    step(r, l, emptyInput());
    expect(r.falls).toBe(1);
    expect(r.trapTime).toBe(0);
  });
  it('crumble disappears after its delay and never restores through the player', () => {
    const l = world(),
      r = createRun(l);
    required(l.tiles[10])[2] = 14;
    step(r, l, emptyInput());
    const key = 10 * 32 + 2;
    expect(r.crumble.has(key)).toBe(true);
    updateTraps(r, l, 1);
    expect(required(r.crumble.get(key)).missing).toBe(true);
    r.player.y = 160;
    updateTraps(r, l, 3);
    expect(r.crumble.has(key)).toBe(true);
    r.player.x = 80;
    updateTraps(r, l, 0.1);
    expect(r.crumble.has(key)).toBe(false);
  });
  it('checkpoint persists through death, resets traps and is cleared on restart', () => {
    const l = world();
    l.entities = [{ id: 'flag', type: 'checkpoint', position: [72, 160] }];
    const r = createRun(l);
    r.player.x = 67;
    step(r, l, emptyInput());
    expect(r.checkpoint).toBe('flag');
    r.broken.add(3);
    r.player.y = 401;
    step(r, l, emptyInput());
    expect(r.player.x).toBe(67);
    expect(r.player.y).toBe(146);
    expect(r.broken.size).toBe(0);
    expect(r.trapTime).toBe(0);
    expect(r.checkpoint).toBe('flag');
    expect(createRun(l).checkpoint).toBeNull();
    expect(playErrors(l)).toEqual([]);
  });
  it('saws use constant-speed paths and reject invalid waypoints', () => {
    const saw: Saw = {
      id: 'blade',
      type: 'saw',
      path: [
        [16, 16],
        [48, 16],
        [48, 48],
      ],
      speed: 16,
      radius: 6,
      mode: 'ping-pong',
      phase: 0,
    };
    expect(sawPosition(saw, 1)).toEqual({ x: 32, y: 16 });
    expect(sawPosition(saw, 3)).toEqual({ x: 48, y: 32 });
    expect(sawPosition(saw, 5)).toEqual({ x: 48, y: 32 });
    expect(() =>
      validateEntities(
        [
          {
            ...saw,
            path: [
              [0, 0],
              [0, 0],
            ],
          },
        ],
        32,
        20,
      ),
    ).toThrow();
    expect(
      required(
        validateEntities(
          [
            {
              ...saw,
              path: [
                [16, 16],
                [16, 16],
                [48, 48],
              ],
            },
          ],
          32,
          20,
        ).find((e) => e.type === 'saw'),
      ).path,
    ).toHaveLength(2);
  });
  it('swept circle/AABB catches fast crossings without killing on tangency', () => {
    const p = { x: 40, y: 40, w: 10, h: 14 };
    expect(sweptSaw({ x: 0, y: 47 }, { x: 100, y: 47 }, 4, p, p)).toBe(true);
    expect(sweptSaw({ x: 0, y: 32 }, { x: 100, y: 32 }, 8, p, p)).toBe(false);
    expect(
      sweptSaw(
        { x: 50, y: 47 },
        { x: 50, y: 47 },
        4,
        { ...p, x: 0 },
        { ...p, x: 100 },
      ),
    ).toBe(true);
  });
});
