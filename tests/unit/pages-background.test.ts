import { describe, it, expect } from 'vitest';
import { MapSession } from '../../src/infrastructure/map-session.ts';
import { BackgroundRenderer } from '../../src/rendering/background.ts';
import { emptyInput } from '../../src/shared/input-state.ts';
import { GameSimulation } from '../../src/simulation/game-simulation.ts';
import { Player } from '../../src/domain/player.ts';
import { level } from '../helpers/level.ts';
class MemoryStorage {
  values = new Map<string, string>();
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
}
describe('temporary map transfer', () => {
  it('replaces per-tab tokens, removes old blobs and rejects expired tokens', async () => {
    const storage = new MemoryStorage(),
      entries = new Map<
        string,
        import('../../src/infrastructure/package-store.ts').StoredPackage
      >();
    const store: import('../../src/infrastructure/package-store.ts').PackageStore =
      {
        put: (entry) => {
          entries.set(entry.token, entry);
          return Promise.resolve();
        },
        get: (token) => Promise.resolve(entries.get(token)),
        delete: (token) => {
          entries.delete(token);
          return Promise.resolve();
        },
        sweep: () => Promise.resolve(),
      };
    const session = new MapSession(storage, store),
      first = await session.save(new Blob(['first'])),
      second = await session.save(new Blob(['second']));
    expect(entries.has(first)).toBe(false);
    expect(entries.has(second)).toBe(true);
    expect(storage.values.size).toBe(1);
    await expect(session.load(first)).rejects.toThrow(/expired/);
    const entry = entries.get(second);
    if (entry) entry.created = 0;
    await expect(session.load(second)).rejects.toThrow(/expired/);
    expect(entries.size).toBe(0);
  });
  it('reports blocked storage without leaving a newly written blob', async () => {
    const storage = {
        getItem: () => null,
        setItem: () => {
          throw new Error('blocked');
        },
      },
      entries = new Map<
        string,
        import('../../src/infrastructure/package-store.ts').StoredPackage
      >();
    const store: import('../../src/infrastructure/package-store.ts').PackageStore =
      {
        put: (entry) => {
          entries.set(entry.token, entry);
          return Promise.resolve();
        },
        get: (token) => Promise.resolve(entries.get(token)),
        delete: (token) => {
          entries.delete(token);
          return Promise.resolve();
        },
        sweep: () => Promise.resolve(),
      };
    await expect(
      new MapSession(storage, store).save(new Blob(['x'])),
    ).rejects.toThrow(/unavailable or full/);
    expect(entries.size).toBe(0);
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
  run.step({ ...emptyInput(), axis: 1 });
  expect(run.player.vx).toBeGreaterThan(0);
  const copy = structuredClone(run);
  expect(Object.hasOwn(copy, 'level')).toBe(false);
  expect(copy.player.x).toBe(run.player.x);
  run.player.y = level.deathY + 10;
  run.step(emptyInput());
  expect(run.player).toBeInstanceOf(Player);
  expect(run.falls).toBe(1);
});
