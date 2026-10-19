import { EntitySystem } from '../domain/entities.ts';
import type {
  Box,
  CollisionRuntime,
  DraftMap,
  Point,
} from '../domain/contracts.ts';
import { solidTiles } from './collision.ts';
/** Bounded swept movement shared by immortal ground/flying bodies. Never breaks terrain. */
export function moveBody(
  level: DraftMap,
  body: Box,
  delta: Point,
  runtime: CollisionRuntime,
  flying: boolean,
) {
  let blocked = false;
  for (const axis of ['x', 'y'] as const) {
    const parts = Math.max(1, Math.ceil(Math.abs(delta[axis]) / 2));
    for (let i = 0; i < parts; i++) {
      const old = body[axis],
        feet = body.y + body.h;
      body[axis] += delta[axis] / parts;
      if (
        body.x < 0 ||
        body.x + body.w > level.width * 16 ||
        body.y < 0 ||
        solidTiles(level, body, runtime).some(
          (t) =>
            t.id !== 8 ||
            flying ||
            (axis === 'y' && delta.y > 0 && feet <= t.y + 0.01),
        )
      ) {
        body[axis] = old;
        blocked = true;
        break;
      }
    }
  }
  return blocked;
}

/** Relative swept AABBs include motion of both actors, avoiding dash tunnelling. */
export function sweptBodies(a0: Box, a1: Box, b0: Box, b1: Box) {
  const epsilon = 1e-7;
  return EntitySystem.segmentBox(
    { x: a0.x - b0.x, y: a0.y - b0.y },
    { x: a1.x - b1.x, y: a1.y - b1.y },
    {
      x: -a0.w + epsilon,
      y: -a0.h + epsilon,
      w: a0.w + b0.w - epsilon * 2,
      h: a0.h + b0.h - epsilon * 2,
    },
  );
}
