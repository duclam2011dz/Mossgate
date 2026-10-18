export class EditorTools {
  static region(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x) + 1,
      h: Math.abs(a.y - b.y) + 1,
    };
  }
}
