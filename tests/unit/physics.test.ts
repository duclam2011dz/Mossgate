import { required } from '../helpers/required.ts';
import type { PlayableMap, Input, TileId } from '../../src/domain/contracts.ts';
import type { GameSimulation } from '../../src/simulation/game-simulation.ts';
import { describe, it, expect } from 'vitest';
import {
  createRun,
  step,
  emptyInput,
} from '../../src/simulation/game-simulation.ts';
import { updateCamera } from '../../src/rendering/camera.ts';
import { moveAxis } from '../../src/simulation/collision.ts';
const makeLevel = (): PlayableMap => ({
  width: 30,
  height: 20,
  tiles: Array.from({ length: 20 }, (_, y) =>
    Array<TileId>(30).fill(y >= 10 ? 1 : 0),
  ),
  spawn: { x: 32, y: 146 },
  portal: { x: 450, y: 120, w: 20, h: 40 },
  deathY: 400,
});
function advance(
  run: GameSimulation,
  map: PlayableMap,
  n: number,
  input: Partial<Input> = {},
) {
  for (let i = 0; i < n; i++)
    step(run, map, {
      ...emptyInput(),
      ...input,
      jumpPressed: i === 0 && !!input.jumpPressed,
      dashPressed: i === 0 && !!input.dashPressed,
    });
}
describe('physics', () => {
  it('locks dash direction and ends dash on a wall', () => {
    const l = makeLevel(),
      r = createRun(l);
    r.player.y = 128;
    advance(r, l, 1, { dashPressed: true });
    advance(r, l, 1, { axis: -1 });
    expect(r.player.facing).toBe(1);
    expect(r.player.vx).toBe(260);
    required(l.tiles[8])[5] = 1;
    advance(r, l, 7);
    expect(r.player.x).toBe(70);
    expect(r.player.dash).toBe(0);
    expect(r.player.vx).toBe(0);
  });
  it('accelerates, caps speed, and stops with friction', () => {
    const l = makeLevel(),
      r = createRun(l);
    advance(r, l, 12, { axis: 1 });
    expect(r.player.vx).toBe(100);
    const x = r.player.x;
    advance(r, l, 10);
    expect(r.player.vx).toBe(0);
    expect(r.player.x).toBeGreaterThan(x);
  });
  it('jumps once per press and cuts height on release', () => {
    const l = makeLevel(),
      a = createRun(l),
      b = createRun(l);
    advance(a, l, 12, { jumpPressed: true, jumpHeld: true });
    advance(b, l, 12, { jumpPressed: true });
    expect(a.player.y).toBeLessThan(b.player.y);
    advance(a, l, 90, { jumpHeld: true });
    expect(a.player.y).toBe(146);
  });
  it('uses jump buffer when landing', () => {
    const l = makeLevel(),
      r = createRun(l);
    r.player.y = 143;
    r.player.vy = 80;
    advance(r, l, 4, { jumpPressed: true, jumpHeld: true });
    expect(r.player.vy).toBeLessThan(0);
  });
  it('allows coyote jump but expires it', () => {
    const l = makeLevel(),
      r = createRun(l);
    l.tiles.forEach((row) => row.fill(0));
    r.player.coyote = 0.1;
    advance(r, l, 1, { jumpPressed: true, jumpHeld: true });
    expect(r.player.vy).toBeLessThan(0);
    const b = createRun(l);
    b.player.coyote = 0.01;
    advance(b, l, 2);
    advance(b, l, 1, { jumpPressed: true });
    expect(b.player.vy).toBeGreaterThan(0);
  });
  it('dashes without gravity and enforces cooldown', () => {
    const l = makeLevel(),
      r = createRun(l);
    r.player.y = 90;
    advance(r, l, 1, { dashPressed: true });
    expect(r.player.vx).toBe(260);
    expect(r.player.vy).toBe(0);
    advance(r, l, 10);
    advance(r, l, 1, { dashPressed: true });
    expect(r.player.dash).toBe(0);
    advance(r, l, 45);
    advance(r, l, 1, { dashPressed: true });
    expect(r.player.dash).toBeGreaterThan(0);
  });
  it('sneak is slower, jumps lower and blocks dash', () => {
    const l = makeLevel(),
      r = createRun(l);
    advance(r, l, 10, { axis: 1, sneak: true, dashPressed: true });
    expect(r.player.vx).toBe(35);
    expect(r.player.cooldown).toBe(0);
    advance(r, l, 1, { sneak: true, jumpPressed: true, jumpHeld: true });
    expect(r.player.vy).toBe(-195);
  });
  it('sneak holds an edge but permits jumping out', () => {
    const l = makeLevel(),
      r = createRun(l);
    l.tiles.forEach((row) => row.fill(0, 4));
    advance(r, l, 120, { axis: 1, sneak: true });
    expect(r.player.x).toBeLessThan(64);
    advance(r, l, 30, {
      axis: 1,
      sneak: true,
      jumpPressed: true,
      jumpHeld: true,
    });
    expect(r.player.x).toBeGreaterThan(64);
  });
  it('resolves walls, floors and ceilings without tunneling', () => {
    const l = makeLevel(),
      r = createRun(l);
    required(l.tiles[8])[5] = 1;
    required(l.tiles[7])[2] = 1;
    r.player.y = 128;
    expect(moveAxis(l, r.player, 'x', 180)).toBe(true);
    expect(r.player.x).toBe(70);
    r.player.x = 32;
    r.player.y = 128;
    expect(moveAxis(l, r.player, 'y', -100)).toBe(true);
    expect(r.player.y).toBe(128);
    r.player.y = 130;
    expect(moveAxis(l, r.player, 'y', 200)).toBe(true);
    expect(r.player.y).toBe(146);
  });
  it('respawns cleanly, preserves time and counts falls', () => {
    const l = makeLevel(),
      r = createRun(l);
    r.player.y = 401;
    r.player.cooldown = 0.5;
    advance(r, l, 1);
    expect(r.falls).toBe(1);
    expect(r.elapsed).toBeGreaterThan(0);
    expect(r.player.x).toBe(32);
    expect(r.player.vx).toBe(0);
    expect(r.player.cooldown).toBe(0);
  });
  it('completes and freezes the run', () => {
    const l = makeLevel(),
      r = createRun(l);
    r.player.x = 450;
    step(r, l, emptyInput());
    expect(r.state).toBe('completed');
    const elapsed = r.elapsed;
    advance(r, l, 20);
    expect(r.elapsed).toBe(elapsed);
  });
  it('camera follows both axes and clamps to finite bounds', () => {
    const l = makeLevel(),
      r = createRun(l),
      camera = { x: 0, y: 0 };
    r.player.x = 470;
    r.player.y = 300;
    updateCamera(camera, r.player, l, 1, true);
    expect(camera).toEqual({ x: 160, y: 140 });
    r.player.x = -100;
    r.player.y = -100;
    updateCamera(camera, r.player, l, 1, true);
    expect(camera).toEqual({ x: 0, y: 0 });
  });
});
