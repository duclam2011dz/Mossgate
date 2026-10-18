import { Player } from '../domain/player.js';
import { config as c } from '../shared/config.js';
import {
  moveAxis,
  overlaps,
  supportTile,
  solidTiles,
  hazards,
} from './collision.js';
import { resolveProperties, resolvedBox } from '../domain/properties.js';
import {
  updateTraps,
  sawHazard,
  activateCheckpoints,
  resetTraps,
} from './traps.js';
import { emptyInput } from '../shared/input-state.js';
export { emptyInput };
export function createPlayer(level) {
  return new Player(level);
}
export class GameSimulation {
  static approach(value, target, amount) {
    return value < target
      ? Math.min(target, value + amount)
      : Math.max(target, value - amount);
  }
  constructor(level) {
    Object.defineProperty(this, 'level', { value: level });
    Object.assign(this, {
      player: new Player(level),
      state: 'playing',
      elapsed: 0,
      falls: 0,
      broken: new Set(),
      events: [],
      trapTime: 0,
      crumble: new Map(),
      checkpoint: null,
      respawn: { ...level.spawn },
    });
  }
  step(input, dt = c.step) {
    return GameSimulation.step(this, this.level, input, dt);
  }
  static step(run, level, input, dt = c.step) {
    if (run.state !== 'playing') return null;
    run.events = [];
    run.elapsed += dt;
    updateTraps(run, level, dt);
    const p = run.player,
      wasGrounded = p.grounded;
    const emit = (type, id = 0, tile = null) =>
      run.events.push({
        type,
        id,
        x: p.x + p.w / 2,
        y: p.y + p.h,
        facing: p.facing,
        ...(tile ? { key: tile.key, properties: tile.props } : {}),
      });
    const feet = p.y + p.h;
    const canStand = !solidTiles(
      level,
      { x: p.x, y: feet - 14, w: p.w, h: 14 },
      run,
    ).some((b) => b.id !== 8);
    p.sneaking = !!input.sneak || !canStand;
    p.h = p.sneaking ? 8 : 14;
    p.y = feet - p.h;
    p.dropTimer = Math.max(0, p.dropTimer - dt);
    if (p.dropKey !== null) {
      const row = Math.floor(p.dropKey / level.width),
        col = p.dropKey % level.width,
        box = resolvedBox(level, 8, col, row);
      if (p.y >= box.y + box.h || p.dropTimer === 0) p.dropKey = null;
    }
    let support = supportTile(level, p, run);
    p.grounded = !!support && p.vy >= 0;
    p.coyote = p.grounded ? c.coyote : Math.max(0, p.coyote - dt);
    p.buffer = input.jumpPressed ? c.buffer : Math.max(0, p.buffer - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (input.axis && p.dash <= 0) p.facing = Math.sign(input.axis);
    if (input.down && input.jumpPressed && support?.id === 8) {
      p.dropKey = support.key;
      p.dropTimer = c.dropDuration;
      p.buffer = 0;
      p.coyote = 0;
      p.grounded = false;
      support = null;
      p.vy = Math.max(30, p.vy);
    }
    if (input.dashPressed && !p.sneaking && p.cooldown === 0) {
      p.dash = c.dashDuration;
      p.cooldown = c.dashCooldown;
      p.vy = 0;
      p.springJump = false;
      emit('dash');
    }
    let jumped = false;
    if (p.buffer > 0 && p.coyote > 0 && p.dash <= 0) {
      p.vy = -c.jump * (p.sneaking ? c.sneakJump : 1);
      p.buffer = 0;
      p.coyote = 0;
      p.grounded = false;
      p.springJump = false;
      jumped = true;
      emit('jump', support?.id);
    }
    const material = support?.props || resolveProperties(level, 0);
    const dashing = p.dash > 0;
    if (dashing) {
      p.vx = p.facing * c.dashSpeed;
      p.vy = 0;
    } else {
      const target =
        input.axis *
        c.run *
        (p.sneaking ? c.sneakSpeed : 1) *
        (material.speed ?? 1);
      p.vx = approach(
        p.vx,
        target,
        (input.axis
          ? c.acceleration * (material.acceleration ?? 1)
          : c.friction * (material.friction ?? 1)) * dt,
      );
      if (!input.jumpHeld && p.vy < 0 && !p.springJump)
        p.vy = Math.max(p.vy, -c.jump * 0.45);
      p.vy = Math.min(c.maxFall, p.vy + c.gravity * dt);
    }
    const oldBox = { x: p.x, y: p.y, w: p.w, h: p.h };
    const oldX = p.x;
    if (
      moveAxis(
        level,
        p,
        'x',
        (p.vx + (p.grounded && !jumped ? material.conveyor || 0 : 0)) * dt,
        run,
      )
    ) {
      p.vx = 0;
      p.dash = 0;
    }
    if (p.sneaking && p.grounded && !jumped && !supportTile(level, p, run)) {
      p.x = oldX;
      p.vx = 0;
    }
    const falling = p.vy >= 0;
    if (moveAxis(level, p, 'y', p.vy * dt, run)) {
      p.vy = 0;
      if (falling) {
        p.grounded = true;
        p.coyote = c.coyote;
      } else p.springJump = false;
    } else p.grounded = !!supportTile(level, p, run) && p.vy >= 0;
    const landed = supportTile(level, p, run);
    if (p.grounded && !wasGrounded) {
      emit('land', landed?.id, landed);
      if (landed?.id === 6) {
        p.vy = -(landed.props.springForce ?? c.springForce);
        p.grounded = false;
        p.coyote = 0;
        p.springJump = true;
        emit('spring', 6, landed);
      }
    }
    p.travel += Math.abs(p.x - oldX);
    if (p.grounded && Math.abs(p.vx) > 5 && p.travel >= 12) {
      p.travel = 0;
      emit('step', landed?.id, landed);
    }
    if (p.grounded && landed?.id === 14 && !run.crumble.has(landed.key))
      run.crumble.set(landed.key, { start: run.trapTime, missing: false });
    if (dashing) p.dash = Math.max(0, p.dash - dt);
    if (
      p.hitHazard ||
      hazards(level, p, run).length ||
      sawHazard(run, level, oldBox, p, dt) ||
      p.y > level.deathY
    ) {
      emit('death');
      run.player = createPlayer({
        ...level,
        spawn: run.respawn || level.spawn,
      });
      run.falls++;
      run.broken.clear();
      resetTraps(run);
      return 'respawn';
    }
    activateCheckpoints(run, level);
    if (overlaps(p, level.portal)) {
      run.state = 'completed';
      emit('complete');
      return 'completed';
    }
    return null;
  }
}
export const createRun = (level) => new GameSimulation(level);
export const step = GameSimulation.step;

const approach = GameSimulation.approach;
