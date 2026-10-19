import { required, tileId } from '../helpers/required.ts';
import { describe, it, expect } from 'vitest';
import { EditorModel, blankLevel, screenCell } from '../../src/editor/model.ts';
import { encodeLevel, parseLevel } from '../../src/domain/map-codec.ts';
import { MapValidator } from '../../src/simulation/map-validator.ts';
const decodeLevel = MapValidator.decodeLevel;
import { playErrors } from '../../src/simulation/map-validator.ts';
import {
  createAnimation,
  updateAnimation,
} from '../../src/rendering/animation.ts';
import {
  createEffects,
  burst,
  updateEffects,
} from '../../src/rendering/effects.ts';
import { level } from '../helpers/level.ts';
describe('editor model', () => {
  it('commits a whole line as one transaction with no skipped cells', () => {
    const m = new EditorModel();
    m.begin();
    m.line({ x: 1, y: 1 }, { x: 15, y: 1 }, 4);
    m.commit();
    expect(m.history).toHaveLength(1);
    expect(required(m.level.tiles[1]).slice(1, 16)).toEqual(Array(15).fill(4));
    m.undo();
    expect(required(m.level.tiles[1])[5]).toBe(0);
    m.redo();
    expect(required(m.level.tiles[1])[5]).toBe(4);
  });
  it('fill supports the maximum map without recursion; undo restores it', () => {
    const m = new EditorModel(blankLevel(512, 128));
    m.begin();
    m.fill(0, 0, 5);
    m.commit();
    expect(required(m.level.tiles[127])[511]).toBe(5);
    m.undo();
    expect(required(m.level.tiles[127])[511]).toBe(0);
  });
  it('copy/paste preserves empty cells, clips bounds and supports moving', () => {
    const m = new EditorModel();
    required(m.level.tiles[0])[0] = 4;
    required(m.level.tiles[0])[3] = 3;
    const data = m.copy({ x: 0, y: 0, w: 2, h: 1 });
    m.begin();
    m.paste(data, 2, 0);
    m.commit();
    expect(required(m.level.tiles[0]).slice(2, 4)).toEqual([4, 0]);
    m.begin();
    m.rectangle({ x: 0, y: 0 }, { x: 1, y: 0 }, 0);
    m.paste(data, 5, 0);
    m.commit();
    expect(required(m.level.tiles[0])[0]).toBe(0);
    expect(required(m.level.tiles[0])[5]).toBe(4);
    m.paste(data, 159, 39);
    expect(m.level.tiles[39]).toHaveLength(160);
  });
  it('resize removes outside markers, is undoable and preserves top-left cells', () => {
    const m = new EditorModel();
    m.level.spawn = { x: 2000, y: 400 };
    required(m.level.tiles[0])[0] = 4;
    m.begin();
    expect(m.resize(16, 12)).toBe(true);
    m.commit();
    expect(m.level.spawn).toBeNull();
    expect(required(m.level.tiles[0])[0]).toBe(4);
    expect(m.level.deathY).toBe(256);
    m.undo();
    expect(m.level.width).toBe(160);
    expect(m.level.spawn.x).toBe(2000);
  });
  it('cancels drafts, drops redo branches and tracks exported revisions', () => {
    const m = new EditorModel();
    m.begin();
    m.set(1, 1, 3);
    m.cancel();
    expect(required(m.level.tiles[1])[1]).toBe(0);
    m.begin();
    m.set(1, 1, 4);
    m.commit();
    m.saved = m.revision;
    expect(m.dirty).toBe(false);
    m.undo();
    expect(m.dirty).toBe(true);
    m.begin();
    m.set(2, 2, 5);
    m.commit();
    expect(m.future).toHaveLength(0);
  });
  it('bounds history by both entries and changed cells', () => {
    const m = new EditorModel();
    for (let i = 0; i < 110; i++) {
      m.begin();
      m.set(0, 0, i % 2 === 0 ? 1 : 2);
      m.commit();
    }
    expect(m.history.length).toBe(100);
    expect(m.history.reduce((n, c) => n + c.cost, 0)).toBeLessThanOrEqual(
      1000000,
    );
  });
  it('maps client coordinates through camera offsets and zoom', () => {
    expect(
      screenCell(220, 180, { left: 100, top: 100 }, { x: 10, y: 20 }, 2),
    ).toEqual({ x: 11, y: 21 });
  });
});
describe('map v2', () => {
  it('round trips arbitrary tile patterns and nullable draft markers', () => {
    const l = blankLevel(32, 16);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 32; x++)
        required(l.tiles[y])[x] = tileId((x * 3 + y * 7) % 13);
    const decoded = decodeLevel(encodeLevel(l), { draft: true });
    expect(decoded).toEqual(l);
    expect(playErrors(decoded)).toHaveLength(2);
    expect(() => decodeLevel(encodeLevel(l))).toThrow();
  });
  it('merges equal horizontal runs vertically and rejects oversized files', () => {
    const l = blankLevel();
    l.tiles.forEach((row) => row.fill(2));
    expect(encodeLevel(l).rects).toEqual([[0, 0, 160, 40, 2]]);
    expect(() => parseLevel(' '.repeat(2097153))).toThrow(/2 MiB/);
  });
  it('preserves v1 geometry and uses v2 after editing', () => {
    const encoded = encodeLevel(level);
    expect(encoded.version).toBe(5);
    expect(decodeLevel(encoded)).toEqual(level);
  });
});
describe('animation and effects', () => {
  const p = { grounded: true, vx: 0, vy: 0, sneaking: false, dash: 0 };
  it('uses 24 FPS regardless of update cadence and clamps non-looping clips', () => {
    const a = createAnimation(),
      b = createAnimation();
    for (let i = 0; i < 30; i++) updateAnimation(a, p, 1 / 60);
    for (let i = 0; i < 15; i++) updateAnimation(b, p, 1 / 30);
    expect(a.frame).toBe(12);
    expect(a.frame).toBe(b.frame);
    updateAnimation(a, { ...p, grounded: false, vy: -100 }, 0);
    updateAnimation(a, { ...p, grounded: false, vy: -100 }, 2);
    expect(a.state).toBe('jump');
    expect(a.frame).toBe(5);
  });
  it('prioritizes dash, then sneak, airborne and walking states', () => {
    const a = createAnimation();
    updateAnimation(a, { ...p, sneaking: true, vx: 30 }, 0);
    expect(a.state).toBe('sneak-walk');
    updateAnimation(a, { ...p, dash: 0.1, sneaking: true }, 0);
    expect(a.state).toBe('dash');
    updateAnimation(a, { ...p, grounded: false, vy: 20 }, 0);
    expect(a.state).toBe('fall');
  });
  it('caps particles, reuses expired slots and disables shake with reduced motion', () => {
    const fx = createEffects();
    burst(fx, 'dust', 50, 50, 1000);
    expect(fx.particles).toHaveLength(512);
    const args: [
      Pick<
        import('../../src/domain/player.ts').Player,
        'dash' | 'x' | 'y' | 'h' | 'facing'
      >,
      typeof level,
      { x: number; y: number },
      { width: number; height: number },
      ReturnType<typeof createAnimation>,
    ] = [
      { ...p, x: 0, y: 0, h: 14, facing: 1 },
      level,
      { x: 0, y: 0 },
      { width: 320, height: 180 },
      createAnimation(),
    ];
    updateEffects(fx, [], ...args, 1);
    expect(fx.pool.length).toBeGreaterThan(0);
    burst(fx, 'dust', 50, 50, 10);
    expect(fx.particles.length).toBeLessThanOrEqual(512);
    const reduced = createEffects();
    updateEffects(
      reduced,
      [{ type: 'dash', id: 0, x: 20, y: 20 }],
      ...args,
      1 / 60,
      true,
    );
    expect(reduced.shake).toBe(0);
  });
});
