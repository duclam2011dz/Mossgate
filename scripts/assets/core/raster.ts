import { PNG } from 'pngjs';
export type Point = [number, number];
type Color = string | readonly number[];
export const SEED = 7421;
export const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
export const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const tint = (color: readonly number[], amount: number) =>
  color.map((n) => clamp(n + amount));
export function hash(x: number, y: number, seed = SEED) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function noise(x: number, y: number, scale: number, seed = SEED) {
  const a = Math.floor(x / scale),
    b = Math.floor(y / scale),
    u = x / scale - a,
    v = y / scale - b;
  const smooth = (t: number) => t * t * (3 - 2 * t),
    sx = smooth(u),
    sy = smooth(v);
  const top = hash(a, b, seed) * (1 - sx) + hash(a + 1, b, seed) * sx;
  const bottom =
    hash(a, b + 1, seed) * (1 - sx) + hash(a + 1, b + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}
export function image(width: number, height: number) {
  const png = new PNG({ width, height });
  function pixel(x: number, y: number, color: Color) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const c = typeof color === 'string' ? rgb(color) : color;
    png.data.set([...c.map(clamp), 255], (y * width + x) * 4);
  }
  function rect(x: number, y: number, w: number, h: number, color: Color) {
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++)
      for (let px = Math.floor(x); px < Math.ceil(x + w); px++)
        pixel(px, py, color);
  }
  function ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: Color,
  ) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)
          pixel(x, y, color);
  }
  function polygon(points: Point[], color: Color) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      const crossings = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i],
          b = points[j];
        if (!a || !b) continue;
        const [ax, ay] = a,
          [bx, by] = b;
        if (ay > y !== by > y)
          crossings.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i < crossings.length; i += 2) {
        const left = crossings[i],
          right = crossings[i + 1];
        if (left === undefined || right === undefined) continue;
        for (let x = Math.ceil(left); x < right; x++) pixel(x, y, color);
      }
    }
  }
  function line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: Color,
    thickness = 1,
  ) {
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))),
    );
    for (let i = 0; i <= steps; i++)
      rect(
        Math.round(x0 + ((x1 - x0) * i) / steps),
        Math.round(y0 + ((y1 - y0) * i) / steps),
        thickness,
        thickness,
        color,
      );
  }
  return { png, pixel, rect, ellipse, polygon, line };
}
