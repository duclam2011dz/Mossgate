import { describe, it, expect } from 'vitest';
import { MapSession } from '../../src/infrastructure/map-session.js';
import { BackgroundRenderer } from '../../src/rendering/background.js';
import { GameSimulation } from '../../src/simulation/game-simulation.js';
import { Player } from '../../src/domain/player.js';
import { level } from '../helpers/level.js';
class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  setItem(k, v) {
    this.values.set(k, v);
  }
  getItem(k) {
    return this.values.get(k) ?? null;
  }
}
describe('temporary map transfer', () => {
  it('round trips, reloads, and replaces the previous map token', () => {
    const store = new MemoryStorage(),
      session = new MapSession(store),
      token = session.save(level);
    expect(session.load(token)).toEqual(level);
    expect(new MapSession(store).load(token)).toEqual(level);
    const newer = session.save(level);
    expect(() => session.load(token)).toThrow(/expired/);
    expect(session.load(newer)).toEqual(level);
    expect(store.values.size).toBe(1);
  });
  it('reports unavailable storage, invalid tokens, corrupted data and invalid play maps', () => {
    const broken = {
      setItem() {
        throw new Error('quota');
      },
      getItem() {
        throw new Error('blocked');
      },
    };
    expect(() => new MapSession(broken).save(level)).toThrow(
      /unavailable or full/,
    );
    expect(() => new MapSession(broken).load('missing')).toThrow(
      /Could not read/,
    );
    const store = new MemoryStorage(),
      session = new MapSession(store);
    expect(() => session.load('missing')).toThrow(/expired/);
    store.setItem(MapSession.key, '{bad');
    expect(() => session.load('x')).toThrow(/Could not read/);
    const token = session.save({ ...level, spawn: null });
    expect(() => session.load(token)).toThrow(/Spawn/);
  });
});
describe('shared background coordinates', () => {
  it('wraps at exact periods in either direction, including huge offsets', () => {
    for (const x of [-6400, -17, 0, 72, 3200, 1e6]) {
      const a = BackgroundRenderer.offset(x, 0.16),
        b = BackgroundRenderer.offset(x + 320 / 0.16, 0.16);
      expect(a).toBeCloseTo(b, 8);
      expect(a).toBeLessThanOrEqual(0);
      expect(a).toBeGreaterThan(-320);
    }
  });
  it('converts editor pan and zoom consistently in both axes', () => {
    const result = BackgroundRenderer.editorView(
      { x: 8, y: 12 },
      0.5,
      960,
      640,
    );
    expect(result).toEqual({
      camera: { x: 128, y: 192 },
      view: { width: 960, height: 640 },
    });
    const zoomed = BackgroundRenderer.editorView({ x: 8, y: 12 }, 1, 960, 640);
    expect(zoomed.camera).toEqual(result.camera);
    expect(zoomed.view.width).toBe(result.view.width / 2);
  });
});
it('simulation owns player state and preserves plain-data snapshots', () => {
  const run = new GameSimulation(level);
  expect(run.player).toBeInstanceOf(Player);
  run.step({ axis: 1 });
  expect(run.player.vx).toBeGreaterThan(0);
  const copy = structuredClone(run);
  expect(copy.level).toBeUndefined();
  expect(copy.player.x).toBe(run.player.x);
  run.player.y = level.deathY + 10;
  run.step({});
  expect(run.player).toBeInstanceOf(Player);
  expect(run.falls).toBe(1);
});
