import type {
  Box,
  CollisionRuntime,
  DraftMap,
  Point,
} from '../domain/contracts.ts';
import { EntitySystem } from '../domain/entities.ts';
import { solidTiles } from './collision.ts';
export interface VisionSource extends Box {
  facing: number;
  stats: { flying: boolean; detectionRange: number };
}
export interface Perception {
  visible(
    source: VisionSource,
    target: Box,
    runtime: CollisionRuntime,
  ): boolean;
}
/** Solid materials occlude the center-to-center ray; one-way platforms do not. */
export class TerrainPerception implements Perception {
  constructor(private readonly level: DraftMap) {}
  visible(source: VisionSource, target: Box, runtime: CollisionRuntime) {
    const a: Point = { x: source.x + source.w / 2, y: source.y + source.h / 2 };
    const b: Point = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    const dx = b.x - a.x,
      dy = b.y - a.y,
      distance = Math.hypot(dx, dy);
    if (
      distance > source.stats.detectionRange ||
      (dx * source.facing) / Math.max(0.001, distance) <
        Math.cos(((source.stats.flying ? 135 : 60) * Math.PI) / 180)
    )
      return false;
    return !solidTiles(
      this.level,
      {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(dx) + 0.001,
        h: Math.abs(dy) + 0.001,
      },
      runtime,
    ).some((tile) => tile.id !== 8 && EntitySystem.segmentBox(a, b, tile));
  }
}
