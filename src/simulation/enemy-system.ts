import type { Box, Enemy, PlayableMap, Point } from '../domain/contracts.ts';
import { enemyStats } from '../domain/enemy-definitions.ts';
import { TerrainPerception } from './perception.ts';
import type { Perception } from './perception.ts';
import type { GameSimulation } from './game-simulation.ts';
import { solidTiles, supportTile, overlaps } from './collision.ts';
import { moveBody, sweptBodies } from './actor-collision.ts';
import { NavigationQueue } from './navigation.ts';
import type { CombatStatus, DirectHit } from './health.ts';
export type EnemyState =
  | 'patrol'
  | 'alert'
  | 'chase'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'search'
  | 'return';
export class EnemyActor implements Box {
  readonly stats;
  x: number;
  y: number;
  w: number;
  h: number;
  facing: number;
  state: EnemyState = 'patrol';
  timer = 0;
  cooldown = 0;
  memory = 0;
  moving = false;
  waypoint = 0;
  vy = 0;
  aim: Point = { x: 1, y: 0 };
  lastSeen: Point;
  path: Point[] = [];
  replan = 0;
  dormant = false;
  constructor(readonly definition: Enemy) {
    this.stats = enemyStats(definition);
    this.x = definition.spawn[0];
    this.y = definition.spawn[1];
    this.w = this.stats.w;
    this.h = this.stats.h;
    this.facing = definition.facing;
    this.lastSeen = { x: this.x, y: this.y };
  }
}
export interface Projectile extends Box {
  id: string;
  vx: number;
  vy: number;
  age: number;
  distance: number;
  range: number;
  damage: number;
  kind: 'spore' | 'thorn' | 'bloom';
  status?: CombatStatus;
}
/** Authored IDs remain stable; runtime projectile IDs are monotonically allocated. */
export class EnemyRegistry {
  readonly actors = new Map<string, EnemyActor>();
  readonly projectiles = new Map<string, Projectile>();
  private serial = 0;
  spawn(definition: Enemy) {
    if (this.actors.size >= 64) throw new Error('Maximum 64 enemy actors.');
    if (this.actors.has(definition.id)) throw new Error('Duplicate actor ID.');
    const actor = new EnemyActor(definition);
    this.actors.set(definition.id, actor);
    return actor;
  }
  remove(id: string) {
    this.actors.delete(id);
    this.projectiles.delete(id);
  }
  query(box: Box) {
    return [...this.actors.values()].filter(
      (actor) => !actor.dormant && overlaps(actor, box),
    );
  }
  fire(projectile: Omit<Projectile, 'id'>) {
    if (this.projectiles.size >= 192) return;
    const id = `projectile-${String(++this.serial).padStart(10, '0')}`;
    this.projectiles.set(id, { ...projectile, id });
  }
}
export class EnemySystem {
  readonly registry = new EnemyRegistry();
  #navigation: NavigationQueue;
  #perception: Perception;
  constructor(private readonly level: PlayableMap) {
    this.#perception = new TerrainPerception(level);
    this.#navigation = new NavigationQueue(level.width, level.height);
    for (const entity of level.entities ?? [])
      if (entity.type === 'enemy') this.registry.spawn(entity);
  }
  get expandedNodes() {
    return this.#navigation.expanded;
  }
  update(run: GameSimulation, dt: number, oldPlayer: Box): DirectHit[] {
    const hits: DirectHit[] = [],
      player = run.player;
    for (const actor of this.registry.actors.values()) {
      const stats = actor.stats,
        definition = actor.definition;
      actor.timer += dt;
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      actor.replan = Math.max(0, actor.replan - dt);
      if (actor.dormant) {
        const spawn = {
          x: definition.spawn[0],
          y: definition.spawn[1],
          w: actor.w,
          h: actor.h,
        };
        if (
          !solidTiles(this.level, spawn, run).some((t) => t.id !== 8) &&
          !overlaps(spawn, player) &&
          (stats.flying || supportTile(this.level, spawn, run))
        ) {
          actor.x = spawn.x;
          actor.y = spawn.y;
          actor.dormant = false;
          actor.vy = 0;
          actor.state = 'patrol';
        } else continue;
      }
      const seen = this.#perception.visible(actor, player, run);
      const homeDistance = Math.hypot(
        actor.x - definition.spawn[0],
        actor.y - definition.spawn[1],
      );
      if (seen && homeDistance < stats.leash && actor.state !== 'return') {
        actor.lastSeen = { x: player.x, y: player.y };
        actor.memory = 2;
        if (actor.state === 'patrol' || actor.state === 'search') {
          actor.state = 'alert';
          actor.timer = 0;
        }
      } else actor.memory = Math.max(0, actor.memory - dt);
      if (homeDistance > stats.leash && actor.state !== 'return') {
        actor.state = 'return';
        actor.timer = 0;
      }
      if (actor.state === 'alert' && actor.timer >= 0.2) {
        actor.state = 'chase';
        actor.timer = 0;
      }
      if (actor.state === 'chase' && actor.memory === 0) {
        actor.state = 'search';
        actor.timer = 0;
      }
      if (actor.state === 'search' && actor.timer >= 3) {
        actor.state = 'return';
        actor.timer = 0;
      }
      let target: Point = { x: actor.x, y: actor.y },
        speed = 0;
      if (actor.state === 'patrol') {
        const point = definition.patrol[actor.waypoint];
        if (point) {
          target = { x: point[0], y: point[1] };
          speed = stats.patrolSpeed;
          if (Math.hypot(target.x - actor.x, target.y - actor.y) < 4)
            actor.waypoint = (actor.waypoint + 1) % definition.patrol.length;
        }
      } else if (actor.state === 'return') {
        target = { x: definition.spawn[0], y: definition.spawn[1] };
        speed = stats.chaseSpeed;
        if (homeDistance < 8) {
          actor.state = 'patrol';
          actor.timer = 0;
        }
      } else if (actor.state === 'chase' || actor.state === 'search') {
        target = actor.lastSeen;
        speed = actor.state === 'search' ? stats.patrolSpeed : stats.chaseSpeed;
        const distance = Math.hypot(player.x - actor.x, player.y - actor.y);
        if (stats.attack === 'bloom' && distance < 128)
          target = {
            x: actor.x - (player.x - actor.x),
            y: actor.y - (player.y - actor.y),
          };
        if (
          actor.state === 'chase' &&
          seen &&
          actor.cooldown === 0 &&
          distance <
            (stats.attack === 'melee'
              ? 32
              : stats.attack === 'charge'
                ? 112
                : stats.detectionRange)
        ) {
          const dx = player.x + player.w / 2 - actor.x - actor.w / 2,
            dy = player.y + player.h / 2 - actor.y - actor.h / 2;
          const length = Math.max(1, Math.hypot(dx, dy));
          actor.aim = { x: dx / length, y: dy / length };
          actor.facing = dx < 0 ? -1 : 1;
          actor.state = 'windup';
          actor.timer = 0;
          speed = 0;
        }
      }
      if (actor.state === 'windup' && actor.timer >= stats.windup) {
        actor.state = 'attack';
        actor.timer = 0;
        actor.cooldown = stats.cooldown;
        if (
          stats.attack === 'spore' ||
          stats.attack === 'thorn' ||
          stats.attack === 'bloom'
        ) {
          const kind = stats.attack;
          for (const angle of kind === 'bloom' ? [-0.18, 0, 0.18] : [0]) {
            const dx =
                actor.aim.x * Math.cos(angle) - actor.aim.y * Math.sin(angle),
              dy =
                actor.aim.x * Math.sin(angle) + actor.aim.y * Math.cos(angle);
            this.registry.fire({
              x: actor.x + actor.w / 2 - 2,
              y: actor.y + actor.h / 2 - 2,
              w: 4,
              h: 4,
              vx: dx * (kind === 'thorn' ? 180 : 130),
              vy:
                dy * (kind === 'thorn' ? 180 : 130) -
                (kind === 'spore' ? 65 : 0),
              age: 0,
              distance: 0,
              range: kind === 'spore' ? 256 : 400,
              damage: stats.attackDamage,
              kind,
              ...(kind === 'spore'
                ? { status: 'poison' as const }
                : kind === 'bloom'
                  ? { status: 'slow' as const }
                  : {}),
            });
          }
        }
      }
      if (actor.state === 'attack') {
        if (stats.attack === 'charge') {
          target = { x: actor.x + actor.aim.x * 100, y: actor.y };
          speed = 230;
        }
        if (stats.attack === 'dive') {
          target = {
            x: actor.x + actor.aim.x * 100,
            y: actor.y + actor.aim.y * 100,
          };
          speed = 210;
        }
        if (
          stats.attack === 'melee' &&
          actor.timer < 0.18 &&
          overlaps(player, {
            x: actor.x - 12,
            y: actor.y,
            w: actor.w + 24,
            h: actor.h,
          })
        )
          hits.push({
            id: definition.id + '-attack',
            damage: stats.attackDamage,
            direction: actor.facing,
          });
        if (
          actor.timer >=
          (stats.attack === 'charge' || stats.attack === 'dive' ? 0.45 : 0.18)
        ) {
          actor.state = 'recover';
          actor.timer = 0;
          speed = 0;
        }
      }
      if (actor.state === 'recover' && actor.timer >= 0.35) {
        actor.state = 'chase';
        actor.timer = 0;
      }
      const old = { x: actor.x, y: actor.y, w: actor.w, h: actor.h };
      if (speed > 0) this.move(actor, target, speed, run, dt);
      if (!stats.flying) {
        actor.vy = Math.min(450, actor.vy + 900 * dt);
        if (moveBody(this.level, actor, { x: 0, y: actor.vy * dt }, run, false))
          actor.vy = 0;
        if (actor.y > this.level.deathY) {
          actor.dormant = true;
          continue;
        }
      }
      actor.moving = Math.hypot(actor.x - old.x, actor.y - old.y) > 0.001;
      if (
        sweptBodies(old, actor, oldPlayer, player) ||
        overlaps(actor, player)
      ) {
        hits.push({
          id: definition.id,
          damage:
            actor.state === 'attack' &&
            (stats.attack === 'charge' || stats.attack === 'dive')
              ? stats.attackDamage
              : stats.contactDamage,
          direction: Math.sign(player.x - actor.x) || actor.facing,
        });
      }
    }
    this.#navigation.update();
    this.updateProjectiles(run, dt, oldPlayer, hits);
    return hits;
  }
  private move(
    actor: EnemyActor,
    target: Point,
    speed: number,
    run: GameSimulation,
    dt: number,
  ) {
    if (actor.stats.flying && actor.state !== 'attack') {
      const path = this.#navigation.take(actor.definition.id);
      if (path) actor.path = path;
      if (actor.replan === 0) {
        this.#navigation.request(
          actor.definition.id,
          { x: actor.x + actor.w / 2, y: actor.y + actor.h / 2 },
          { x: target.x + actor.w / 2, y: target.y + actor.h / 2 },
          actor,
          (box) => !solidTiles(this.level, box, run).length,
        );
        actor.replan = 0.5;
      }
      const waypoint = actor.path[0];
      if (!waypoint) return;
      target = waypoint;
      if (Math.hypot(waypoint.x - actor.x, waypoint.y - actor.y) < 3)
        actor.path.shift();
    }
    const dx = target.x - actor.x,
      dy = actor.stats.flying ? target.y - actor.y : 0;
    const distance = Math.max(1, Math.hypot(dx, dy)),
      amount = Math.min(speed * dt, distance);
    const delta = { x: (dx / distance) * amount, y: (dy / distance) * amount };
    if (delta.x) actor.facing = delta.x < 0 ? -1 : 1;
    if (
      !actor.stats.flying &&
      supportTile(this.level, actor, run) &&
      !supportTile(
        this.level,
        { ...actor, x: actor.x + delta.x + (actor.facing * actor.w) / 2 },
        run,
      )
    ) {
      if (actor.state === 'patrol')
        actor.waypoint = (actor.waypoint + 1) % actor.definition.patrol.length;
      return;
    }
    if (
      moveBody(this.level, actor, delta, run, actor.stats.flying) &&
      actor.state === 'patrol'
    )
      actor.waypoint = (actor.waypoint + 1) % actor.definition.patrol.length;
  }
  private updateProjectiles(
    run: GameSimulation,
    dt: number,
    oldPlayer: Box,
    hits: DirectHit[],
  ) {
    for (const shot of this.registry.projectiles.values()) {
      const parts = Math.max(
        1,
        Math.ceil((Math.hypot(shot.vx, shot.vy) * dt) / 2),
      );
      if (shot.kind === 'spore') shot.vy += 90 * dt;
      let consumed = false;
      for (let i = 0; i < parts; i++) {
        const previousShot = { x: shot.x, y: shot.y, w: shot.w, h: shot.h };
        shot.x += (shot.vx * dt) / parts;
        shot.y += (shot.vy * dt) / parts;
        const tile = solidTiles(this.level, shot, run)[0];
        if (tile) {
          if (shot.kind === 'bloom') {
            if (tile.id === 11 && tile.props.breakable) {
              run.broken.add(tile.key);
              run.events.push({
                type: 'break',
                id: 11,
                x: tile.x + 8,
                y: tile.y + 8,
                key: tile.key,
                properties: tile.props,
              });
            }
            if (tile.id === 14 && !run.crumble.has(tile.key))
              run.crumble.set(tile.key, {
                start: run.trapTime,
                missing: false,
              });
          }
          consumed = true;
          break;
        }
        const f = (i + 1) / parts,
          playerAt = {
            ...run.player,
            x: oldPlayer.x + (run.player.x - oldPlayer.x) * f,
            y: oldPlayer.y + (run.player.y - oldPlayer.y) * f,
          };
        const previousPlayer = {
          ...oldPlayer,
          x: oldPlayer.x + ((run.player.x - oldPlayer.x) * i) / parts,
          y: oldPlayer.y + ((run.player.y - oldPlayer.y) * i) / parts,
        };
        if (sweptBodies(previousShot, shot, previousPlayer, playerAt)) {
          hits.push({
            id: shot.id,
            damage: shot.damage,
            direction: Math.sign(shot.vx) || 1,
            ...(shot.status ? { status: shot.status } : {}),
          });
          consumed = true;
          break;
        }
      }
      shot.age += dt;
      shot.distance += Math.hypot(shot.vx, shot.vy) * dt;
      if (consumed || shot.age >= 3 || shot.distance > shot.range)
        this.registry.projectiles.delete(shot.id);
    }
  }
}
