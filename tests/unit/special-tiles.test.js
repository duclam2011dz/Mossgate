import { describe, it, expect } from 'vitest';
import {
  createRun,
  step,
  emptyInput,
} from '../../src/simulation/game-simulation.js';
import { moveAxis, supportTile } from '../../src/simulation/collision.js';
const world = (id = 1) => ({
  width: 40,
  height: 20,
  tiles: Array.from({ length: 20 }, (_, y) => Array(40).fill(y >= 10 ? id : 0)),
  spawn: { x: 32, y: 146 },
  portal: { x: 600, y: 120, w: 20, h: 40 },
  deathY: 400,
});
function advance(r, l, n, controls = {}) {
  for (let i = 0; i < n; i++)
    step(r, l, {
      ...emptyInput(),
      ...controls,
      jumpPressed: i === 0 && !!controls.jumpPressed,
      dashPressed: i === 0 && !!controls.dashPressed,
    });
}
describe('material physics', () => {
  it('ice reduces acceleration and stopping friction', () => {
    const l = world(4),
      r = createRun(l);
    advance(r, l, 10, { axis: 1 });
    expect(r.player.vx).toBeCloseTo(30);
    advance(r, l, 1);
    expect(r.player.vx).toBeCloseTo(26);
  });
  it('mud reduces speed and acceleration without slowing dash', () => {
    const l = world(5),
      r = createRun(l);
    advance(r, l, 20, { axis: 1 });
    expect(r.player.vx).toBe(50);
    advance(r, l, 1, { dashPressed: true });
    expect(r.player.vx).toBe(260);
  });
  it('conveyors move at 45 units/s and cannot push through walls', () => {
    const l = world(10),
      r = createRun(l);
    advance(r, l, 60);
    expect(r.player.x).toBeCloseTo(77);
    l.tiles[9][6] = 1;
    advance(r, l, 60);
    expect(r.player.x).toBe(86);
  });
  it('sneak protects the edge even against a conveyor', () => {
    const l = world(10),
      r = createRun(l);
    l.tiles.forEach((row) => row.fill(0, 4));
    advance(r, l, 120, { sneak: true });
    expect(r.player.x).toBeLessThan(64);
    expect(r.falls).toBe(0);
  });
  it('spring bounces once on contact and keeps its full upward force', () => {
    const l = world(6),
      r = createRun(l);
    advance(r, l, 1, { sneak: true });
    expect(r.player.vy).toBe(-420);
    expect(r.events.filter((e) => e.type === 'spring')).toHaveLength(1);
    advance(r, l, 1, { sneak: true });
    expect(r.player.vy).toBe(-405);
    expect(r.events.filter((e) => e.type === 'spring')).toHaveLength(0);
  });
  it('a tile under the center wins at material boundaries', () => {
    const l = world(1),
      r = createRun(l);
    l.tiles[10][2] = 4;
    l.tiles[10][3] = 5;
    r.player.x = 44;
    expect(supportTile(l, r.player).id).toBe(5);
  });
});
describe('special collision', () => {
  it('one-way allows movement upward and lands only from above', () => {
    const l = world(8),
      r = createRun(l);
    r.player.y = 170;
    expect(moveAxis(l, r.player, 'y', -50, r)).toBe(false);
    expect(moveAxis(l, r.player, 'y', 80, r)).toBe(true);
    expect(r.player.y).toBe(146);
  });
  it('S+W drops through only the supporting platform', () => {
    const l = world(8),
      r = createRun(l);
    for (let y = 11; y < 20; y++) l.tiles[y].fill(0);
    l.tiles[13].fill(1);
    advance(r, l, 1, { down: true, jumpPressed: true });
    expect(r.player.dropKey).not.toBeNull();
    advance(r, l, 40);
    expect(r.player.y).toBe(194);
    expect(r.falls).toBe(0);
  });
  it('slabs collide on their lower half', () => {
    const l = world(12),
      r = createRun(l);
    r.player.y = 130;
    moveAxis(l, r.player, 'y', 100, r);
    expect(r.player.y).toBe(154);
  });
  it('crouching anchors feet and forced crouch prevents standing through a ceiling', () => {
    const l = world(),
      r = createRun(l);
    advance(r, l, 1, { sneak: true });
    expect(r.player.h).toBe(8);
    expect(r.player.y + r.player.h).toBe(160);
    l.tiles[9][2] = 12; // Bottom half of ceiling intersects the standing box.
    r.player.y = 160;
    r.player.h = 8;
    l.tiles[10][2] = 0;
    l.tiles[10][3] = 0;
    l.tiles[11][2] = 12;
    r.player.y = 176;
    r.player.h = 8;
    // Put a ceiling directly above a true eight-unit opening.
    l.tiles[10][2] = 1;
    l.tiles[11][2] = 12;
    r.player.y = 176;
    r.player.h = 8;
    r.player.x = 34;
    advance(r, l, 1);
    expect(r.player.sneaking).toBe(true);
    expect(r.player.h).toBe(8);
    expect(r.player.y + r.player.h).toBe(184);
    l.tiles[10][2] = 0;
    advance(r, l, 1);
    expect(r.player.h).toBe(14);
    expect(r.player.y + r.player.h).toBe(184);
  });
  it('dash breaks a block without mutating the original grid; respawn restores it', () => {
    const l = world(),
      r = createRun(l);
    l.tiles[9][4] = 11;
    r.player.x = 48;
    advance(r, l, 1, { dashPressed: true });
    advance(r, l, 4);
    expect(r.broken.has(9 * 40 + 4)).toBe(true);
    expect(l.tiles[9][4]).toBe(11);
    expect(r.player.x).toBeGreaterThan(54);
    r.player.y = 401;
    advance(r, l, 1);
    expect(r.broken.size).toBe(0);
    expect(r.falls).toBe(1);
  });
  it('walking cannot break stone and hazards cannot be tunneled through', () => {
    const l = world(),
      r = createRun(l);
    l.tiles[9][4] = 11;
    advance(r, l, 30, { axis: 1 });
    expect(r.player.x).toBe(54);
    expect(r.broken.size).toBe(0);
    l.tiles[9][4] = 7;
    r.player.x = 48;
    advance(r, l, 6, { dashPressed: true });
    expect(r.falls).toBe(1);
  });
  it('dash emits once and coyote/buffer do not re-emit held input', () => {
    const l = world(),
      r = createRun(l);
    advance(r, l, 1, { dashPressed: true });
    expect(r.events.filter((e) => e.type === 'dash')).toHaveLength(1);
    advance(r, l, 1);
    expect(r.events.filter((e) => e.type === 'dash')).toHaveLength(0);
  });
});
