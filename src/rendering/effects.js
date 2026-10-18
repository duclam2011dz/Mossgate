import { resolveProperties } from '../domain/properties.js';
import { effectNames } from '../shared/asset-definitions.js';
export { effectNames };

export class EffectsSystem {
  static random(fx) {
    fx.seed = ((fx.seed || 7421) * 1664525 + 1013904223) >>> 0;
    return fx.seed / 4294967296;
  }
  constructor() {
    Object.assign(this, {
      particles: [],
      pool: [],
      ghosts: [],
      clock: 0,
      ambient: 0,
      shake: 0,
      springs: new Map(),
    });
  }
  static createEffects() {
    return new EffectsSystem();
  }
  static burst(fx, kind, x, y, count = 10, power = 35, properties = {}) {
    count = Math.round(count * (properties?.effectsIntensity ?? 1));
    for (let i = 0; i < count && fx.particles.length < 512; i++) {
      const p = fx.pool.pop() || {};
      Object.assign(p, {
        kind,
        color: properties?.effectsColor,
        x,
        y,
        vx: (random(fx) - 0.5) * power * 2,
        vy: -random(fx) * power,
        age: 0,
        life: 0.35 + random(fx) * 0.4,
        size: kind === 'burst' ? 22 : kind === 'ring' ? 18 : 2 + random(fx) * 3,
      });
      fx.particles.push(p);
    }
  }
  static updateEffects(
    fx,
    events,
    p,
    level,
    camera,
    view,
    anim,
    dt,
    reduced = false,
    broken,
  ) {
    fx.clock += dt;
    fx.shake = Math.max(0, fx.shake - dt);
    for (const event of events) {
      const eventBurst = (...args) => burst(...args, event.properties);
      const material =
        event.id === 4
          ? 'ice'
          : event.id === 5
            ? 'mud'
            : event.id === 9 || event.id === 10
              ? 'spark'
              : 'dust';
      if (event.type === 'checkpoint') {
        eventBurst(fx, 'ring', event.x, event.y, 1, 0);
        eventBurst(fx, 'spark', event.x, event.y, 24, 35);
      }
      if (event.type === 'dash') {
        eventBurst(fx, 'burst', event.x, event.y - 5, 1, 0);
        eventBurst(fx, 'spark', event.x, event.y - 5, 22, 60);
        eventBurst(fx, 'ring', event.x, event.y - 5, 1, 0);
        if (!reduced) fx.shake = 0.1;
      }
      if (event.type === 'step')
        eventBurst(fx, material, event.x, event.y, 5, 16);
      if (event.type === 'land')
        eventBurst(fx, material, event.x, event.y, 12, 28);
      if (event.type === 'break')
        eventBurst(fx, 'debris', event.x, event.y, 24, 65);
      if (event.type === 'spring') {
        eventBurst(fx, 'ring', event.x, event.y, 1, 0);
        eventBurst(fx, 'spark', event.x, event.y, 14, 35);
        fx.springs.set(
          `${Math.floor(event.x / 16)},${Math.floor(event.y / 16)}`,
          fx.clock,
        );
      }
    }
    if (p.dash > 0) {
      fx.ghosts.push({
        x: p.x,
        y: p.y + p.h,
        facing: p.facing,
        state: anim.state,
        frame: anim.frame,
        age: 0,
      });
      if (fx.ghosts.length > 8) fx.ghosts.shift();
    }
    fx.ghosts = fx.ghosts.filter((g) => (g.age += dt) < 0.18);
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const part = fx.particles[i];
      part.age += dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vy +=
        (['ring', 'burst'].includes(part.kind)
          ? 0
          : part.kind === 'spark'
            ? 25
            : 90) * dt;
      const outside =
        part.x < camera.x - 32 ||
        part.x > camera.x + view.width + 32 ||
        part.y < camera.y - 32 ||
        part.y > camera.y + view.height + 32;
      if (part.age > part.life || outside) {
        fx.pool.push(part);
        fx.particles.splice(i, 1);
      }
    }
    for (const [key, start] of fx.springs)
      if (fx.clock - start > 0.3) fx.springs.delete(key);
    fx.ambient += dt;
    if (fx.ambient >= 0.12) {
      fx.ambient = 0;
      let emitters = 0;
      for (
        let y = Math.max(0, Math.floor(camera.y / 16));
        y < Math.min(level.height, Math.ceil((camera.y + view.height) / 16));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(camera.x / 16));
          x < Math.min(level.width, Math.ceil((camera.x + view.width) / 16));
          x++
        ) {
          const id = broken?.has(y * level.width + x) ? 0 : level.tiles[y][x];
          if (![4, 5, 6, 7, 9, 10, 11, 13, 14].includes(id) || ++emitters > 64)
            continue;
          if (random(fx) > 0.25) continue;
          burst(
            fx,
            id === 4
              ? 'ice'
              : id === 5
                ? 'mud'
                : id === 11
                  ? 'debris'
                  : 'spark',
            x * 16 + random(fx) * 16,
            y * 16,
            1,
            8,
            resolveProperties(level, id, x, y),
          );
        }
    }
  }
}
export const createEffects = EffectsSystem.createEffects;
export const burst = EffectsSystem.burst;
export const updateEffects = EffectsSystem.updateEffects;

const random = EffectsSystem.random;
