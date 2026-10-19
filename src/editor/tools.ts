import type { Point } from '../domain/contracts.ts';
export class EditorTools {
  static region(this: void, a: Point, b: Point) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x) + 1,
      h: Math.abs(a.y - b.y) + 1,
    };
  }
}
