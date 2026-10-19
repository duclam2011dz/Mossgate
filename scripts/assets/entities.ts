import { PNG } from 'pngjs';
import type { Point } from './core/raster.ts';
import { image, hash, tint, rgb } from './core/raster.ts';
import { specialTile } from './core/motifs.ts';
function ancientGate() {
  const im = image(128, 128),
    { pixel, rect, ellipse, line, polygon } = im;
  ellipse(64, 74, 44, 52, '#162e2e');
  rect(26, 71, 76, 53, '#162e2e');
  ellipse(64, 72, 28, 43, '#2b5b51');
  rect(36, 69, 56, 54, '#2b5b51');
  ellipse(62, 75, 20, 38, '#477e67');
  rect(43, 73, 39, 50, '#477e67');
  ellipse(59, 80, 10, 29, '#87b49a');
  rect(50, 81, 18, 40, '#87b49a');
  for (let y = 39; y < 120; y++)
    for (let x = 39; x < 89; x++)
      if (
        ((x - 64) / 24) ** 2 + ((y - 82) / 44) ** 2 < 1 &&
        hash(x, y, 17) > 0.97
      )
        pixel(x, y, '#add4af');
  // Individual voussoirs follow a half-ellipse; their chamfers reveal the arch.
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i * Math.PI) / 9,
      b = Math.PI + ((i + 1) * Math.PI) / 9;
    const points: [Point, Point, Point, Point] = [
      [64 + 46 * Math.cos(a), 68 + 50 * Math.sin(a)],
      [64 + 46 * Math.cos(b), 68 + 50 * Math.sin(b)],
      [64 + 29 * Math.cos(b), 68 + 32 * Math.sin(b)],
      [64 + 29 * Math.cos(a), 68 + 32 * Math.sin(a)],
    ];
    polygon(points, '#35483e');
    const inner = points.map(([x, y]): Point => [
      64 + (x - 64) * 0.97,
      67 + (y - 67) * 0.97,
    ]);
    polygon(inner, tint(rgb('#7a8267'), Math.cos(a) * -9));
    line(points[0][0], points[0][1], points[1][0], points[1][1], '#adb08c', 2);
  }
  for (const x of [18, 93])
    for (let row = 0; row < 4; row++) {
      const y = 65 + row * 14;
      rect(x, y, 18, 14, '#32463d');
      rect(x + 1, y, 16, 12, '#77806a');
      rect(x + 1, y, 15, 2, '#a2a78a');
      rect(x + 15, y + 2, 2, 10, '#505f4f');
      for (let i = 0; i < 8; i++)
        pixel(
          x + 2 + hash(i, row + x) * 12,
          y + 3 + hash(row, i + x) * 7,
          '#889075',
        );
      line(x + 6, y + 4, x + 9, y + 7, '#b4d0a0');
      line(x + 9, y + 7, x + 6, y + 10, '#b4d0a0');
    }
  rect(12, 121, 104, 7, '#4b5b4b');
  rect(15, 119, 98, 5, '#8b9379');
  rect(15, 119, 98, 1, '#b0b293');
  for (let i = 0; i < 32; i++) {
    const x = 16 + hash(i, 100) * 97,
      y = 24 + hash(i, 101) * 96;
    if (x < 35 || x > 94 || y < 42) {
      ellipse(x, y, 3, 2, '#4e6541');
      pixel(x - 1, y - 1, '#8b9c5b');
    }
  }
  line(30, 24, 24, 55, '#364b35', 2);
  line(25, 47, 20, 53, '#758653', 2);
  line(101, 72, 105, 101, '#40523a', 2);
  return im.png;
}
function timedSpikes(phase: string) {
  const im = image(64, 64),
    base = specialTile(7);
  if (phase === 'active') return base;
  const height = phase === 'warning' ? 10 : 4;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const from =
        (Math.min(63, Math.floor(56 + ((y - 56) / Math.max(1, height)) * 8)) *
          64 +
          x) *
        4;
      if (y >= 56 && base.data[from + 3])
        im.pixel(x, y, [...base.data.subarray(from, from + 3)]);
    }
  im.rect(0, 57, 64, 7, phase === 'warning' ? '#c69136' : '#667267');
  if (phase === 'warning')
    for (let x = 2; x < 64; x += 12) im.ellipse(x, 52, 2, 2, '#f1c56b');
  return im.png;
}
function crumbleSheet() {
  const sheet = new PNG({ width: 64 * 12, height: 64 });
  for (let frame = 0; frame < 12; frame++) {
    const im = image(64, 64),
      base = specialTile(11);
    PNG.bitblt(base, im.png, 0, 0, 64, 64, 0, 0);
    for (let i = 0; i <= frame; i++) {
      const x = hash(i, 400) * 64,
        y = hash(i, 401) * 64;
      im.line(x, y, x + 10, y + 8, '#2c3b31', 1 + frame / 5);
    }
    PNG.bitblt(im.png, sheet, 0, 0, 64, 64, frame * 64, 0);
  }
  return sheet;
}
function sawSprite(frame = 0) {
  const im = image(64, 64),
    points: Point[] = [];
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32 + frame / 144) * Math.PI * 2,
      r = i % 2 ? 24 : 31;
    points.push([32 + Math.cos(angle) * r, 32 + Math.sin(angle) * r]);
  }
  im.polygon(points, '#a8b2a1');
  im.ellipse(32, 32, 22, 22, '#52675f');
  im.ellipse(30, 30, 17, 17, '#b9c3ad');
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + (frame / 12) * Math.PI;
    im.line(
      32 + Math.cos(a) * 6,
      32 + Math.sin(a) * 6,
      32 + Math.cos(a) * 15,
      32 + Math.sin(a) * 15,
      '#687b6b',
      3,
    );
  }
  im.ellipse(32, 32, 5, 5, '#b08743');
  return im.png;
}
function sawSheet() {
  const out = new PNG({ width: 64 * 12, height: 64 });
  for (let i = 0; i < 12; i++)
    PNG.bitblt(sawSprite(i), out, 0, 0, 64, 64, i * 64, 0);
  return out;
}
function flag(active = false) {
  const im = image(64, 64);
  im.rect(21, 8, 3, 56, '#746443');
  im.rect(21, 8, 1, 56, '#d2c394');
  im.polygon(
    [
      [24, 8],
      [55, 12],
      [47, 23],
      [55, 33],
      [24, 29],
    ],
    active ? '#d3b64b' : '#799566',
  );
  im.line(26, 10, 48, 13, active ? '#f6df8d' : '#b2c28c', 2);
  im.rect(13, 60, 23, 4, '#8c9272');
  return im.png;
}
export class EntityGenerator {
  static generate() {
    return {
      portal: ancientGate(),
      'timed-spikes': timedSpikes('active'),
      'timed-spikes-retracted': timedSpikes('retracted'),
      'timed-spikes-warning': timedSpikes('warning'),
      crumble: specialTile(11),
      'trap-crumble': crumbleSheet(),
      saw: sawSprite(),
      'entity-saw': sawSheet(),
      checkpoint: flag(),
      'checkpoint-active': flag(true),
    };
  }
}
