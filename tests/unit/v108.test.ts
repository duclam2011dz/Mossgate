import { replayWildwood } from '../helpers/wildwood-driver.ts';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type {
  Enemy,
  EnemySpecies,
  PlayableMap,
  TileId,
} from '../../src/domain/contracts.ts';
import { GlassWaterModel } from '../../src/domain/glass-water.ts';
import { PlayerHealth } from '../../src/simulation/health.ts';
import { NavigationQueue } from '../../src/simulation/navigation.ts';
import {
  GameSimulation,
  emptyInput,
} from '../../src/simulation/game-simulation.ts';
import { enemyDefinitions } from '../../src/domain/enemy-definitions.ts';
import { validateEntities } from '../../src/domain/entities.ts';
import { MapCodec } from '../../src/domain/map-codec.ts';
import { MapValidator } from '../../src/simulation/map-validator.ts';
import { EditorModel } from '../../src/editor/model.ts';
import { updateTraps } from '../../src/simulation/traps.ts';
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
function enemy(species: EnemySpecies, x = 160): Enemy {
  const stats = enemyDefinitions[species],
    y = stats.flying ? 256 : 320 - stats.h;
  return {
    id: species,
    type: 'enemy',
    species,
    spawn: [x, y],
    facing: -1,
    patrol: [
      [x - 32, y],
      [x + 32, y],
    ],
  };
}
describe('wet glass lifecycle', () => {
  it('fades before rebirth and keeps all pools bounded over many lifetimes', () => {
    let seed = 17;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const model = new GlassWaterModel(64, random);
    let births = 0,
      trails = false;
    for (let i = 0; i < 60 * 120; i++) {
      const ages = model.drops.map((d) => d.age);
      model.update(1 / 60, 400, 300, false);
      model.drops.forEach((d, j) => {
        if (d.age < (ages[j] ?? 0)) {
          births++;
          expect(d.opacity).toBe(0);
        }
        expect(d.opacity).toBeGreaterThanOrEqual(0);
        expect(d.opacity).toBeLessThanOrEqual(1);
      });
      expect(model.drops.length).toBeLessThanOrEqual(32);
      expect(model.trails.length).toBeLessThanOrEqual(32);
      trails ||= model.trails.length > 0;
    }
    expect(births).toBeGreaterThan(100);
    expect(trails).toBe(true);
  });
  it('does not translate in reduced motion, and resize retains existing drop identity/age', () => {
    const model = new GlassWaterModel(4, () => 0.5),
      first = model.drops[0];
    if (!first) throw new Error('Missing drop');
    first.wait = 0;
    const before = { x: first.x, y: first.y };
    for (let i = 0; i < 180; i++) model.update(1 / 60, 800, 600, true);
    expect({ x: first.x, y: first.y }).toEqual(before);
    expect(model.trails).toHaveLength(0);
    const age = first.age;
    model.update(1 / 60, 250, 400, true);
    expect(model.drops[0]).toBe(first);
    expect(first.age).toBeGreaterThan(age);
  });
  it('coalesces without relocating a visible absorbed droplet', () => {
    const model = new GlassWaterModel(2, () => 0.5),
      [a, b] = model.drops;
    if (!a || !b) throw new Error('Missing drops');
    a.wait = b.wait = 0;
    a.radius = 5;
    a.age = 2;
    b.age = 2;
    b.opacity = 1;
    const position = { x: b.x, y: b.y };
    model.update(1 / 60, 400, 300, false);
    expect(b.fading).toBe(true);
    expect({ x: b.x, y: b.y }).toEqual(position);
    expect(b.opacity).toBeGreaterThan(0);
  });
});
describe('player health', () => {
  it('selects the highest simultaneous hit with stable ID ties and protects direct/status damage', () => {
    const hp = new PlayerHealth();
    expect(
      hp.apply([
        { id: 'z', damage: 20, direction: 1 },
        { id: 'b', damage: 35, direction: 1 },
        { id: 'a', damage: 35, direction: -1 },
      ])?.id,
    ).toBe('a');
    expect(hp.hp).toBe(65);
    expect(
      hp.apply([{ id: 's', damage: 25, direction: 1, status: 'poison' }]),
    ).toBeNull();
    expect(hp.poison).toBe(0);
  });
  it('poison ticks four times, can kill, and refresh preserves the next tick', () => {
    const hp = new PlayerHealth();
    hp.hp = 25;
    hp.apply([{ id: 'a', damage: 5, direction: 1, status: 'poison' }]);
    for (let i = 0; i < 240; i++) hp.update(1 / 60);
    expect(hp.hp).toBe(0);
    hp.reset(0);
    hp.apply([{ id: 'a', damage: 1, direction: 1, status: 'poison' }]);
    hp.update(0.8);
    hp.apply([{ id: 'b', damage: 1, direction: 1, status: 'poison' }]);
    hp.update(0.2);
    expect(hp.hp).toBe(93);
  });
  it('defeat increments deaths once, pauses statuses and retry preserves elapsed while resetting runtime', () => {
    const level = world(),
      run = new GameSimulation(level);
    run.health.hp = 0;
    run.step(emptyInput());
    expect(run.state).toBe('defeated');
    expect(run.falls).toBe(1);
    const elapsed = run.elapsed;
    run.health.poison = 3;
    run.step(emptyInput());
    expect(run.health.poison).toBe(3);
    expect(run.falls).toBe(1);
    run.retry();
    expect(run.elapsed).toBe(elapsed);
    expect(run.falls).toBe(1);
    expect(run.health.hp).toBe(100);
    expect(run.health.poison).toBe(0);
    expect(run.health.immunity).toBe(1);
  });
  it('prioritizes hazards over combat and defeat over checkpoint healing and completion', () => {
    const level = world();
    level.portal = { ...level.spawn, w: 20, h: 32 };
    level.entities = [{ id: 'c', type: 'checkpoint', position: [37, 320] }];
    const run = new GameSimulation(level);
    run.health.hp = 0;
    expect(run.step(emptyInput())).toBe('defeated');
    expect(run.healedCheckpoints.size).toBe(0);
    const falling = new GameSimulation(world());
    falling.player.y = 600;
    falling.health.hp = 0;
    expect(falling.step(emptyInput())).toBe('respawn');
    expect(falling.health.hp).toBe(100);
  });
  it('heals each checkpoint once per run', () => {
    const level = world();
    level.entities = [
      { id: 'a', type: 'checkpoint', position: [37, 320] },
      { id: 'b', type: 'checkpoint', position: [101, 320] },
    ];
    const run = new GameSimulation(level);
    run.health.hp = 40;
    run.step(emptyInput());
    expect(run.health.hp).toBe(100);
    run.player.x = 96;
    run.step(emptyInput());
    run.health.hp = 30;
    run.player.x = 32;
    run.step(emptyInput());
    expect(run.health.hp).toBe(30);
  });
});
describe('entity contracts and runtime', () => {
  it('roundtrips all six species with sparse overrides and rejects invalid input', () => {
    const level = world();
    level.entities = (Object.keys(enemyDefinitions) as EnemySpecies[]).map(
      (s, i) => enemy(s, 160 + i * 96),
    );
    const wire = MapCodec.encodeLevel(level);
    expect(wire.version).toBe(5);
    expect(MapCodec.decodeLevel(wire).entities).toEqual(
      [...level.entities].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(() =>
      validateEntities(
        [{ ...enemy('thorn-wisp'), species: 'unknown' }],
        64,
        32,
      ),
    ).toThrow();
    expect(() =>
      validateEntities(
        [{ ...enemy('thorn-wisp'), overrides: { cooldown: 0 } }],
        64,
        32,
      ),
    ).toThrow();
    expect(() =>
      validateEntities([enemy('thorn-wisp'), enemy('thorn-wisp')], 64, 32),
    ).toThrow();
    expect(() =>
      validateEntities(
        Array.from({ length: 65 }, (_, i) => ({
          ...enemy('thorn-wisp'),
          id: `e${i}`,
        })),
        64,
        32,
      ),
    ).toThrow();
  });
  it('restores background and full enemy paths across resize and history, and gives copies new IDs', () => {
    const level = world();
    level.background = { preset: 'rain', image: './custom.png' };
    level.entities = [enemy('thorn-wisp')];
    const model = new EditorModel(level),
      copied = model.copy({ x: 8, y: 14, w: 8, h: 6 });
    model.begin();
    expect(model.paste(copied, 20, 14)).toBe(0);
    model.commit();
    expect(model.level.entities?.[1]?.id).not.toBe(level.entities[0]?.id);
    model.begin();
    model.resize(16, 32);
    model.commit();
    expect(model.level.background).toEqual(level.background);
    model.undo();
    expect(model.level.entities).toHaveLength(2);
    model.undo();
    expect(model.level.entities).toEqual(level.entities);
  });
  it('shares navigation expansion budget and returns only orthogonal paths around walls', () => {
    const nav = new NavigationQueue(64, 32),
      box = { x: 0, y: 0, w: 10, h: 10 };
    for (let i = 0; i < 64; i++)
      nav.request(
        `e${i}`,
        { x: 8, y: 8 },
        { x: 1000, y: 480 },
        box,
        (b) => !(b.x > 128 && b.x < 144 && b.y < 300),
      );
    for (let i = 0; i < 300; i++) {
      nav.update();
      expect(nav.expanded).toBeLessThanOrEqual(512);
    }
    const path = nav.take('e0');
    expect(path?.length).toBeGreaterThan(0);
    path?.forEach((p, i) => {
      const previous = path[i - 1];
      if (previous) expect(p.x === previous.x || p.y === previous.y).toBe(true);
    });
  });
  it.each(Object.keys(enemyDefinitions) as EnemySpecies[])(
    '%s detects visible player and freezes with pause',
    (species) => {
      const level = world();
      level.entities = [enemy(species, 90)];
      const run = new GameSimulation(level);
      for (let i = 0; i < 30; i++) run.step(emptyInput());
      const actor = run.enemies.registry.actors.get(species);
      expect(actor?.state).not.toBe('patrol');
      run.state = 'paused';
      const before = structuredClone(actor);
      run.step(emptyInput());
      expect(structuredClone(actor)).toEqual(before);
      expect(run.enemies.expandedNodes).toBeLessThanOrEqual(512);
    },
  );
  it('does not detect through solid terrain', () => {
    const level = world();
    level.entities = [enemy('bramble-guard', 96)];
    for (let y = 0; y < 20; y++) {
      const row = level.tiles[y];
      if (row) row[4] = 2;
    }
    const run = new GameSimulation(level);
    run.step(emptyInput());
    expect(run.enemies.registry.actors.get('bramble-guard')?.state).toBe(
      'patrol',
    );
  });
  it('does not restore crumble through an enemy body', () => {
    const level = world();
    level.entities = [enemy('thorn-wisp', 160)];
    const row = level.tiles[16];
    if (row) row[10] = 14;
    const run = new GameSimulation(level);
    run.crumble.set(16 * 64 + 10, { start: 0, missing: true, returnAt: 0 });
    updateTraps(run, level, 1 / 60);
    expect(run.crumble.size).toBe(1);
  });
  it('ships a structurally and physically valid Day showcase', () => {
    const level = MapCodec.parseLevel(
      readFileSync('public/maps/wildwood-trials.json', 'utf8'),
    );
    expect(level.background?.preset).toBe('day');
    const replay = replayWildwood(
      new GameSimulation(MapValidator.playable(level)),
      MapValidator.playable(level),
    );
    expect(replay.state).toBe('completed');
    expect(replay.falls).toBe(0);
    expect(MapValidator.playErrors(level)).toEqual([]);
    expect(
      new Set(
        level.entities?.flatMap((e) => (e.type === 'enemy' ? [e.species] : [])),
      ).size,
    ).toBe(6);
  });
});
