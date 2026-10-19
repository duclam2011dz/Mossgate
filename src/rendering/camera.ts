import type { Point, Box } from '../domain/contracts.ts';
import { config as c } from '../shared/config.ts';

export class Camera {
  static updateCamera(
    this: void,
    camera: Point,
    player: Box,
    level: { width: number; height: number },
    dt = 1 / 60,
    snap = false,
    viewport: { width: number; height: number } = c,
  ) {
    const center = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
    for (const [axis, size, margin] of [
      ['x', viewport.width, Math.min(56, viewport.width * 0.175)],
      ['y', viewport.height, 28],
    ] satisfies ['x' | 'y', number, number][]) {
      let target = camera[axis];
      const screen = center[axis] - target;
      if (snap) target = center[axis] - size / 2;
      else if (screen < size / 2 - margin)
        target = center[axis] - (size / 2 - margin);
      else if (screen > size / 2 + margin)
        target = center[axis] - (size / 2 + margin);
      const max = Math.max(
        0,
        level[axis === 'x' ? 'width' : 'height'] * c.tile - size,
      );
      camera[axis] = Math.max(
        0,
        Math.min(
          max,
          snap
            ? target
            : camera[axis] + (target - camera[axis]) * (1 - Math.exp(-10 * dt)),
        ),
      );
    }
    return camera;
  }
}
export const updateCamera = Camera.updateCamera;
