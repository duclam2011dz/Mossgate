import { resolveProperties, resolvedBox } from '../domain/properties.js';
import { sawPosition, sweptSaw } from '../domain/entities.js';
import { overlaps, solidTiles, supported, hazards } from './collision.js';

export class TrapSystem {
  static resetTraps(run) {
    run.trapTime = 0;
    run.crumble = new Map();
  }
  static updateTraps(run, level, dt) {
    run.trapTime += dt;
    for (const [key, state] of run.crumble) {
      const x = key % level.width,
        y = Math.floor(key / level.width),
        props = resolveProperties(level, 14, x, y);
      if (!state.missing && run.trapTime - state.start >= props.delay) {
        state.missing = true;
        state.returnAt = run.trapTime + props.downtime;
        run.events.push({
          type: 'break',
          id: 14,
          key,
          x: x * 16 + 8,
          y: y * 16 + 8,
          properties: props,
        });
      } else if (
        state.missing &&
        run.trapTime >= state.returnAt &&
        !overlaps(run.player, resolvedBox(level, 14, x, y))
      )
        run.crumble.delete(key);
    }
  }
  static sawHazard(run, level, oldBox, newBox, dt) {
    for (const e of level.entities || [])
      if (e.type === 'saw') {
        // Break movement at path corners so a loop never sweeps a diagonal shortcut.
        const parts = Math.max(1, Math.ceil((e.speed * dt) / 2));
        for (let i = 0; i < parts; i++) {
          const a = sawPosition(e, run.trapTime - dt + (dt * i) / parts),
            b = sawPosition(e, run.trapTime - dt + (dt * (i + 1)) / parts),
            boxAt = (f) => ({
              ...oldBox,
              x: oldBox.x + (newBox.x - oldBox.x) * f,
              y: oldBox.y + (newBox.y - oldBox.y) * f,
            });
          if (
            sweptSaw(a, b, e.radius, boxAt(i / parts), boxAt((i + 1) / parts))
          )
            return true;
        }
      }
    return false;
  }
  static activateCheckpoints(run, level) {
    for (const e of level.entities || [])
      if (
        e.type === 'checkpoint' &&
        run.checkpoint !== e.id &&
        overlaps(run.player, {
          x: e.position[0] - 8,
          y: e.position[1] - 32,
          w: 16,
          h: 32,
        })
      ) {
        const spawn = { x: e.position[0] - 5, y: e.position[1] - 14 },
          box = { ...spawn, w: 10, h: 14 };
        if (
          !solidTiles(level, box, run).some((b) => b.id !== 8) &&
          supported(level, box, run) &&
          !hazards(level, box).length
        ) {
          run.checkpoint = e.id;
          run.respawn = spawn;
          run.events.push({
            type: 'checkpoint',
            x: e.position[0],
            y: e.position[1] - 14,
            id: 0,
          });
        }
      }
  }
}
export const resetTraps = TrapSystem.resetTraps;
export const updateTraps = TrapSystem.updateTraps;
export const sawHazard = TrapSystem.sawHazard;
export const activateCheckpoints = TrapSystem.activateCheckpoints;
