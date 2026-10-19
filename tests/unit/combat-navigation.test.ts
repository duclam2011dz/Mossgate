import { expect, it } from 'vitest';
import type { Enemy, PlayableMap, TileId } from '../../src/domain/contracts.ts';
import {
  GameSimulation,
  emptyInput,
} from '../../src/simulation/game-simulation.ts';
import { TerrainPerception } from '../../src/simulation/perception.ts';
import { moveBody, sweptBodies } from '../../src/simulation/actor-collision.ts';
import { NavigationQueue } from '../../src/simulation/navigation.ts';
import { validateEntities } from '../../src/domain/entities.ts';
import { MapCodec } from '../../src/domain/map-codec.ts';
function world(): PlayableMap {
  return {
    width: 64,
    height: 32,
    tiles: Array.from({ length: 32 }, (_, y) =>
      Array<TileId>(64).fill(y >= 20 ? 2 : 0),
    ),
    spawn: { x: 32, y: 306 },
    portal: { x: 980, y: 288, w: 20, h: 32 },
    deathY: 576,
  };
}
const guard: Enemy = {
  id: 'guard',
  type: 'enemy',
  species: 'bramble-guard',
  spawn: [120, 300],
  facing: 1,
  patrol: [
    [112, 300],
    [224, 300],
  ],
};
it('distinguishes forward ground vision from the wider flying cone', () => {
  const run = new GameSimulation(world()),
    vision = new TerrainPerception(world());
  const source = {
    x: 100,
    y: 100,
    w: 16,
    h: 16,
    facing: 1,
    stats: { flying: false, detectionRange: 320 },
  };
  expect(vision.visible(source, { x: 80, y: 60, w: 10, h: 14 }, run)).toBe(
    false,
  );
  expect(
    vision.visible(
      { ...source, stats: { ...source.stats, flying: true } },
      { x: 80, y: 60, w: 10, h: 14 },
      run,
    ),
  ).toBe(true);
  expect(vision.visible(source, { x: 30, y: 100, w: 10, h: 14 }, run)).toBe(
    false,
  );
});
it('sweeps relative actor movement including a fast player crossing a stationary body', () => {
  const a = { x: 100, y: 20, w: 14, h: 20 };
  expect(
    sweptBodies(
      a,
      a,
      { x: 0, y: 20, w: 10, h: 14 },
      { x: 200, y: 20, w: 10, h: 14 },
    ),
  ).toBe(true);
  expect(
    sweptBodies(
      a,
      a,
      { x: 0, y: 80, w: 10, h: 14 },
      { x: 200, y: 80, w: 10, h: 14 },
    ),
  ).toBe(false);
  const level = world(),
    run = new GameSimulation(level),
    body = { x: 32, y: 288, w: 10, h: 14 };
  const row = level.tiles[18];
  if (row) row[3] = 2;
  moveBody(level, body, { x: 200, y: 0 }, run, false);
  expect(body.x + body.w).toBeLessThanOrEqual(48);
});
it('ground enemies do not deliberately walk off an unsupported edge', () => {
  const level = world();
  level.spawn.x = 900;
  level.entities = [guard];
  for (let y = 20; y < 32; y++) level.tiles[y]?.fill(0, 10);
  const run = new GameSimulation(level);
  for (let i = 0; i < 600; i++) run.step(emptyInput());
  const actor = run.enemies.registry.actors.get('guard');
  expect(actor?.y).toBeCloseTo(300);
  expect(actor?.x).toBeLessThan(160);
});
it('falling ground enemies wait for safe supported spawn rather than dying', () => {
  const level = world();
  level.spawn.x = 900;
  level.entities = [guard];
  const run = new GameSimulation(level),
    actor = run.enemies.registry.actors.get('guard');
  if (!actor) throw new Error('Missing guard');
  level.tiles[20]?.fill(0);
  actor.y = 600;
  run.step(emptyInput());
  expect(actor.dormant).toBe(true);
  run.step(emptyInput());
  expect(actor.dormant).toBe(true);
  level.tiles[20]?.fill(2);
  run.step(emptyInput());
  expect(actor.dormant).toBe(false);
  expect(actor.y).toBeCloseTo(300);
});
it('leash return moves normally and does not teleport to spawn', () => {
  const level = world();
  level.entities = [guard];
  const run = new GameSimulation(level),
    actor = run.enemies.registry.actors.get('guard');
  if (!actor) throw new Error('Missing guard');
  actor.x = 700;
  run.step(emptyInput());
  expect(actor.state).toBe('return');
  expect(actor.x).toBeGreaterThan(690);
});
it('unreachable navigation completes with an empty path under the shared budget', () => {
  const nav = new NavigationQueue(16, 16),
    body = { x: 8, y: 8, w: 14, h: 14 };
  nav.request(
    'blocked',
    { x: 8, y: 8 },
    { x: 240, y: 240 },
    body,
    (box) => box.x < 16 && box.y < 16,
  );
  nav.update();
  expect(nav.expanded).toBeLessThanOrEqual(512);
  expect(nav.take('blocked')).toEqual([]);
});
it.each(['spore-pod', 'thorn-wisp', 'bloom-sentinel'] as const)(
  '%s locks aim before windup and fires at the active boundary',
  (species) => {
    const level = world();
    level.entities = [
      {
        ...guard,
        id: species,
        species,
        spawn: [160, 260],
        patrol: [
          [144, 260],
          [176, 260],
        ],
      },
    ];
    const run = new GameSimulation(level),
      actor = run.enemies.registry.actors.get(species);
    if (!actor) throw new Error('Missing enemy');
    actor.state = 'windup';
    actor.aim = { x: 1, y: 0 };
    actor.timer = actor.stats.windup - 0.025;
    run.enemies.update(run, 1 / 60, run.player);
    expect(run.enemies.registry.projectiles.size).toBe(0);
    run.player.x = 400;
    run.enemies.update(run, 1 / 60, run.player);
    expect(run.enemies.registry.projectiles.size).toBe(
      species === 'bloom-sentinel' ? 3 : 1,
    );
    expect(
      [...run.enemies.registry.projectiles.values()].every((p) => p.vx > 0),
    ).toBe(true);
  },
);
it('caps projectiles and consumes immune-player hits without applying status', () => {
  const run = new GameSimulation(world());
  run.health.reset();
  for (let i = 0; i < 300; i++)
    run.enemies.registry.fire({
      x: 32,
      y: 306,
      w: 4,
      h: 4,
      vx: 0,
      vy: 0,
      age: 0,
      distance: 0,
      range: 100,
      damage: 25,
      kind: 'spore',
      status: 'poison',
    });
  expect(run.enemies.registry.projectiles.size).toBe(192);
  run.step(emptyInput());
  expect(run.enemies.registry.projectiles.size).toBe(0);
  expect(run.health.hp).toBe(100);
  expect(run.health.poison).toBe(0);
});
it.each([
  { kind: 'thorn', tile: 11, allowed: true, broken: false },
  { kind: 'bloom', tile: 11, allowed: true, broken: true },
  { kind: 'bloom', tile: 11, allowed: false, broken: false },
  { kind: 'bloom', tile: 2, allowed: true, broken: false },
] as const)(
  'projectile $kind breaks terrain $tile only with the explicit Bloom permission ($allowed)',
  ({ kind, tile, allowed, broken }) => {
    const level = world(),
      row = level.tiles[18];
    if (row) row[10] = tile;
    if (tile === 11) level.cellOverrides = { '10,18': { breakable: allowed } };
    const run = new GameSimulation(level);
    run.enemies.registry.fire({
      x: 150,
      y: 290,
      w: 4,
      h: 4,
      vx: 180,
      vy: 0,
      age: 0,
      distance: 0,
      range: 400,
      damage: 25,
      kind,
    });
    for (let i = 0; i < 10; i++) run.step(emptyInput());
    expect(run.broken.has(18 * 64 + 10)).toBe(broken);
    expect(run.enemies.registry.projectiles.size).toBe(0);
  },
);
it('Bloom starts crumble once without extending its countdown', () => {
  const level = world(),
    row = level.tiles[18];
  if (row) row[10] = 14;
  const run = new GameSimulation(level);
  const fire = () =>
    run.enemies.registry.fire({
      x: 155,
      y: 290,
      w: 4,
      h: 4,
      vx: 180,
      vy: 0,
      age: 0,
      distance: 0,
      range: 400,
      damage: 25,
      kind: 'bloom',
    });
  fire();
  run.step(emptyInput());
  const start = run.crumble.get(18 * 64 + 10)?.start;
  expect(start).toBeDefined();
  for (let i = 0; i < 10; i++) run.step(emptyInput());
  fire();
  run.step(emptyInput());
  expect(run.crumble.get(18 * 64 + 10)?.start).toBe(start);
});
it('slow reduces horizontal movement while retaining jump and dash forces', () => {
  const a = new GameSimulation(world()),
    b = new GameSimulation(world());
  b.health.slow = 3;
  for (let i = 0; i < 30; i++) {
    a.step({ ...emptyInput(), axis: 1 });
    b.step({ ...emptyInput(), axis: 1 });
  }
  expect(b.player.vx / a.player.vx).toBeCloseTo(0.6);
  a.step({ ...emptyInput(), axis: 1, jumpPressed: true, jumpHeld: true });
  b.step({ ...emptyInput(), axis: 1, jumpPressed: true, jumpHeld: true });
  expect(b.player.vy).toBe(a.player.vy);
  a.step({ ...emptyInput(), axis: 1, dashPressed: true });
  b.step({ ...emptyInput(), axis: 1, dashPressed: true });
  expect(b.player.vx).toBe(a.player.vx);
});
it('v4 remains readable but enemies require a v5 declaration; sparse defaults disappear on export', () => {
  const level = world(),
    wire = MapCodec.encodeLevel(level);
  expect(MapCodec.decodeLevel({ ...wire, version: 4 }).width).toBe(64);
  expect(() =>
    MapCodec.decodeLevel({ ...wire, version: 4, entities: [guard] }),
  ).toThrow(/version 5/);
  const normalized = validateEntities(
    [
      {
        ...guard,
        overrides: { attackDamage: 35, chaseSpeed: 64, contactDamage: 21 },
      },
    ],
    64,
    32,
  )[0];
  expect(normalized?.type === 'enemy' && normalized.overrides).toEqual({
    contactDamage: 21,
  });
});
