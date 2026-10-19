import { required } from '../helpers/required.ts';
import { describe, it, expect } from 'vitest';
import { MapValidator } from '../../src/simulation/map-validator.ts';
const decodeLevel = MapValidator.decodeLevel;
import { createViewport } from '../../src/rendering/viewport.ts';
import { updateCamera } from '../../src/rendering/camera.ts';
import { mapData } from '../helpers/level.ts';
describe('JSON rectangles', () => {
  it('expands rectangles with later regions overriding earlier ones', () => {
    const data = structuredClone(mapData);
    data.rects.push([5, 5, 3, 2, 3], [6, 5, 1, 1, 0]);
    const l = decodeLevel(data);
    expect(required(l.tiles[5]).slice(5, 8)).toEqual([3, 0, 3]);
    expect(required(l.tiles[6])[6]).toBe(3);
    expect(required(l.tiles[4])[6]).toBe(0);
  });
  it.each<
    [string, (d: Record<string, unknown> & { rects?: number[][] }) => unknown]
  >([
    ['version', (d) => (d.version = 99)],
    ['size', (d) => (d.size = [0, 40])],
    ['size', (d) => (d.size = [160.5, 40])],
    ['rects', (d) => delete d.rects],
    ['rectangle', (d) => required(d.rects).push([159, 0, 2, 1, 1])],
    ['rectangle', (d) => required(d.rects).push([0, 0, 1, 1, 9])],
    ['rectangle', (d) => required(d.rects).push([0, 0, 1.5, 1, 1])],
    ['rectangle', (d) => required(d.rects).push([0, 0, -1, 1, 1])],
    ['spawn', (d) => (d.spawn = [0, 0])],
    ['spawn', (d) => (d.spawn = [48, 480])],
    ['portal', (d) => (d.portal = [2464, 480, 20, 32])],
    ['portal', (d) => (d.portal = [2464, 384, 0, 32])],
    ['deathY', (d) => (d.deathY = 600)],
  ])('rejects invalid %s', (_, mutate) => {
    const data: Record<string, unknown> & { rects?: number[][] } = {
      ...structuredClone(mapData),
    };
    mutate(data);
    expect(() => decodeLevel(data)).toThrow(/Invalid map/);
  });
});
describe('responsive viewport', () => {
  it('keeps vertical world span and aspect ratio without letterboxing', () => {
    for (const [w, h] of [
      [1280, 800],
      [480, 900],
      [2560, 1080],
      [1, 1],
    ] satisfies [number, number][]) {
      const v = createViewport(w, h);
      expect(v.height).toBe(180);
      expect(v.width / v.height).toBeCloseTo(required(w) / required(h));
      expect(v.bufferHeight).toBeLessThanOrEqual(720);
    }
  });
  it('caps HiDPI resolution at native asset density', () => {
    expect(createViewport(1280, 800, 3)).toEqual(createViewport(1280, 800, 1));
    const v = createViewport(480, 360, 2);
    expect(v.bufferHeight).toBe(720);
    expect(v.bufferWidth).toBe(960);
  });
  it('clamps the camera immediately when resize exposes the world edge', () => {
    const l = decodeLevel(mapData),
      p = { x: 2460, y: 384, w: 10, h: 14 },
      camera = { x: 2300, y: 400 };
    updateCamera(camera, p, l, 0, false, { width: 1000, height: 180 });
    expect(camera.x).toBe(1560);
    updateCamera(camera, p, l, 0, false, { width: 3000, height: 180 });
    expect(camera.x).toBe(0);
  });
});
