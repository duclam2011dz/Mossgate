import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { clips, effectNames } from '../src/shared/asset-definitions.js';

const SEED = 7421;
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const tint = (color, amount) => color.map((n) => clamp(n + amount));
function hash(x, y, seed = SEED) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, scale, seed = SEED) {
  const a = Math.floor(x / scale),
    b = Math.floor(y / scale),
    u = x / scale - a,
    v = y / scale - b;
  const smooth = (t) => t * t * (3 - 2 * t),
    sx = smooth(u),
    sy = smooth(v);
  const top = hash(a, b, seed) * (1 - sx) + hash(a + 1, b, seed) * sx;
  const bottom =
    hash(a, b + 1, seed) * (1 - sx) + hash(a + 1, b + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}
function image(width, height) {
  const png = new PNG({ width, height });
  function pixel(x, y, color) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const c = typeof color === 'string' ? rgb(color) : color;
    png.data.set([...c.map(clamp), 255], (y * width + x) * 4);
  }
  function rect(x, y, w, h, color) {
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++)
      for (let px = Math.floor(x); px < Math.ceil(x + w); px++)
        pixel(px, py, color);
  }
  function ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)
          pixel(x, y, color);
  }
  function polygon(points, color) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      const crossings = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i],
          [bx, by] = points[j];
        if (ay > y !== by > y)
          crossings.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i < crossings.length; i += 2)
        for (let x = Math.ceil(crossings[i]); x < crossings[i + 1]; x++)
          pixel(x, y, color);
    }
  }
  function line(x0, y0, x1, y1, color, thickness = 1) {
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
function earthSurface(name) {
  const im = image(64, 64),
    { pixel, line, ellipse, polygon } = im;
  const base = rgb('#665442');
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const strata = Math.sin(y * 0.27 + Math.sin(x * 0.08) * 0.5) * 3;
      const detail =
        (noise(x, y, 12) - 0.5) * 14 + (hash(x, y) - 0.5) * 7 + strata;
      pixel(x, y, tint(base, detail));
    }
  // Small embedded mineral fragments, shaded consistently from the upper left.
  for (let i = 0; i < 22; i++) {
    const x = hash(i, 1) * 64,
      y = hash(i, 2) * 64,
      r = 1 + hash(i, 3) * 2;
    ellipse(x, y, r + 1, r, '#433c32');
    ellipse(x, y - 1, r, r * 0.6, '#887860');
  }
  for (let i = 0; i < 4; i++) {
    const y = 12 + i * 15;
    line(0, y, 20, y + 3, '#5a4838');
    line(20, y + 3, 42, y + 1, '#5a4838');
    line(42, y + 1, 63, y + 4, '#5a4838');
  }
  if (name === 'stone') {
    polygon(
      [
        [7, 20],
        [20, 10],
        [47, 14],
        [59, 35],
        [52, 54],
        [22, 58],
        [5, 43],
      ],
      '#393f37',
    );
    polygon(
      [
        [8, 19],
        [23, 9],
        [47, 13],
        [57, 34],
        [48, 51],
        [20, 54],
        [6, 40],
      ],
      '#697064',
    );
    polygon(
      [
        [8, 19],
        [23, 9],
        [47, 13],
        [38, 23],
        [17, 28],
        [6, 40],
      ],
      '#8a8e78',
    );
    polygon(
      [
        [38, 23],
        [47, 13],
        [57, 34],
        [48, 51],
        [40, 38],
      ],
      '#505b51',
    );
    line(23, 10, 27, 27, '#a0a18a');
    line(27, 27, 40, 38, '#3e4940');
    line(40, 38, 31, 51, '#3e4940');
    line(27, 27, 16, 35, '#485044');
    for (let i = 0; i < 50; i++) {
      const x = 10 + Math.floor(hash(i, 41) * 40),
        y = 18 + Math.floor(hash(i, 42) * 29);
      if (hash(x, y) > 0.55) pixel(x, y, '#818571');
    }
    for (let i = 0; i < 12; i++) {
      const x = 7 + hash(i, 52) * 15,
        y = 20 + hash(i, 53) * 16;
      ellipse(x, y, 3, 1, '#607443');
      pixel(x, y - 1, '#8a9858');
    }
  }
  if (name === 'grass') {
    for (let x = 0; x < 64; x++) {
      const depth = 9 + Math.floor(noise(x, 0, 8) * 7);
      for (let y = 0; y < depth; y++) {
        const amount = (noise(x, y, 5) - 0.5) * 25 - y * 1.1;
        pixel(x, y, tint(rgb('#637c40'), amount));
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(hash(i, 61) * 64);
      line(x, 9, x + 2, 19 + hash(i, 63) * 14, '#443d2c');
      line(x + 1, 9, x + 3, 17 + hash(i, 63) * 14, '#8b7450');
    }
    for (let x = 0; x < 64; x += 2) {
      const h = 2 + Math.floor(hash(x, 71) * 6);
      line(x, 8, x - 2, h, '#94a957');
      if (x % 4 === 0) line(x + 1, 7, x + 2, 1, '#bec27a');
      pixel(x, 0, '#a7b46a');
    }
    for (let i = 0; i < 9; i++) {
      const x = hash(i, 81) * 64;
      ellipse(x, 8 + hash(i, 82) * 3, 3, 1, '#344e33');
      line(x, 6, x + 3, 5, '#b5bd77');
    }
  }
  return im.png;
}
function explorer() {
  const im = image(64, 64),
    { rect, ellipse, polygon, line, pixel } = im;
  // Boots and trousers anchor the sprite exactly to the old logical footprint.
  rect(20, 44, 11, 17, '#293b34');
  rect(35, 44, 11, 17, '#26372f');
  rect(21, 45, 3, 12, '#58624a');
  rect(36, 45, 2, 12, '#4c5742');
  rect(18, 58, 14, 6, '#342d28');
  rect(34, 58, 15, 6, '#342d28');
  rect(18, 58, 14, 2, '#765c40');
  rect(34, 58, 14, 2, '#695139');
  rect(18, 63, 14, 1, '#171f1d');
  rect(34, 63, 15, 1, '#171f1d');
  polygon(
    [
      [19, 28],
      [43, 27],
      [49, 45],
      [43, 50],
      [18, 48],
      [15, 37],
    ],
    '#333c2d',
  );
  polygon(
    [
      [19, 29],
      [41, 28],
      [45, 46],
      [20, 47],
      [17, 36],
    ],
    '#a07b42',
  );
  polygon(
    [
      [20, 29],
      [30, 30],
      [27, 46],
      [20, 46],
      [17, 36],
    ],
    '#c7a66a',
  );
  polygon(
    [
      [34, 29],
      [41, 28],
      [45, 46],
      [36, 47],
    ],
    '#806437',
  );
  rect(13, 31, 7, 17, '#52533b');
  rect(12, 33, 5, 11, '#8a8050');
  line(12, 34, 12, 42, '#b2a36a');
  polygon(
    [
      [42, 29],
      [48, 31],
      [51, 43],
      [46, 47],
      [42, 37],
    ],
    '#9c7945',
  );
  rect(46, 43, 6, 7, '#bd9769');
  rect(46, 43, 2, 5, '#e4bd86');
  rect(20, 45, 24, 3, '#4e3f2d');
  rect(29, 45, 5, 4, '#b7a36a');
  rect(30, 46, 3, 2, '#584831');
  line(21, 29, 38, 44, '#3b4433', 3);
  line(22, 29, 39, 44, '#8c8c58');
  rect(35, 35, 7, 7, '#685735');
  rect(35, 35, 7, 1, '#d0ac67');
  pixel(38, 38, '#cdb375');
  ellipse(32, 20, 10, 12, '#473b2d');
  ellipse(33, 20, 9, 10, '#d0a378');
  polygon(
    [
      [24, 15],
      [29, 13],
      [33, 17],
      [31, 27],
      [27, 28],
      [24, 23],
    ],
    '#e4bf8c',
  );
  polygon(
    [
      [39, 16],
      [42, 20],
      [44, 22],
      [40, 24],
      [39, 28],
      [34, 28],
      [35, 24],
    ],
    '#a67956',
  );
  rect(37, 19, 3, 2, '#232e2b');
  pixel(37, 19, '#e0d9a9');
  line(37, 26, 40, 26, '#674b38');
  rect(23, 15, 5, 7, '#534736');
  rect(24, 16, 2, 3, '#806343');
  polygon(
    [
      [21, 3],
      [39, 2],
      [44, 12],
      [19, 13],
    ],
    '#66784b',
  );
  polygon(
    [
      [22, 4],
      [34, 3],
      [33, 10],
      [20, 11],
    ],
    '#98a167',
  );
  rect(20, 10, 23, 4, '#454d32');
  rect(15, 13, 35, 3, '#89945a');
  rect(15, 13, 34, 1, '#c0bd7b');
  rect(19, 16, 27, 2, '#303e2d');
  line(24, 5, 25, 9, '#b3b479');
  rect(37, 11, 4, 2, '#b3a36c');
  return im.png;
}
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
    const points = [
      [64 + 46 * Math.cos(a), 68 + 50 * Math.sin(a)],
      [64 + 46 * Math.cos(b), 68 + 50 * Math.sin(b)],
      [64 + 29 * Math.cos(b), 68 + 32 * Math.sin(b)],
      [64 + 29 * Math.cos(a), 68 + 32 * Math.sin(a)],
    ];
    polygon(points, '#35483e');
    const inner = points.map(([x, y]) => [
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
function forest(layer = 'all') {
  const im = image(1280, 960),
    { pixel, ellipse, polygon, line, rect } = im;
  function foliage(cx, cy, rx, ry, color) {
    const base = rgb(color);
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++)
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        const nx = (x - cx) / rx,
          ny = (y - cy) / ry;
        const clusters = noise(x, y, 7, SEED + 53);
        if (nx * nx + ny * ny > 0.9 + clusters * 0.22) continue;
        const light =
          (-nx - ny) * 1.8 +
          (clusters - 0.5) * 7 +
          (hash(x, y, SEED + 61) > 0.88 ? 2 : 0);
        pixel(x, y, tint(base, Math.round(light / 2) * 2));
      }
  }
  if (layer === 'all' || layer === 'sky') {
    // Quantized atmospheric shading remains pixel art rather than a smooth filter.
    for (let y = 0; y < 960; y++)
      for (let x = 0; x < 1280; x++) {
        const light = Math.max(
          0,
          1 - Math.hypot((x - 950) / 1000, (y - 100) / 1100),
        );
        const amount =
          Math.round((light * 14 + (noise(x, y, 90) - 0.5) * 3) / 2) * 2;
        pixel(x, y, tint(rgb('#203c3b'), amount - y * 0.008));
      }
    ellipse(966, 120, 41, 41, '#9baf96');
    ellipse(951, 109, 33, 32, '#abb99d');
  }
  if (layer === 'all' || layer === 'distant') {
    // Distant ridges, ruins and trunks use progressively darker, quieter colors.
    polygon(
      [
        [0, 500],
        [150, 400],
        [300, 480],
        [470, 350],
        [710, 450],
        [900, 360],
        [1120, 470],
        [1280, 390],
        [1280, 960],
        [0, 960],
      ],
      '#294c45',
    );
    for (let i = 0; i < 16; i++) {
      const x = i * 84 + hash(i, 111) * 20,
        top = 170 + hash(i, 112) * 190;
      polygon(
        [
          [x - 6, 960],
          [x + 4, top],
          [x + 20, top],
          [x + 30, 960],
        ],
        '#2e5148',
      );
      line(x + 10, top + 60, x - 35, top + 14, '#2e5148', 7);
      line(x + 12, top + 80, x + 55, top + 21, '#2e5148', 5);
      for (let k = 0; k < 6; k++)
        foliage(
          x - 38 + hash(k, i + 120) * 100,
          top - 25 + hash(i, k + 120) * 75,
          36 + hash(i, k) * 30,
          22,
          '#2e5148',
        );
    }
  }
  if (layer === 'all' || layer === 'midground') {
    for (const x of [167, 746, 1110]) {
      const top = x === 746 ? 390 : 470;
      rect(x, top, 29, 490, '#355348');
      rect(x - 8, top - 7, 45, 13, '#3e5d4e');
      rect(x + 4, top + 10, 4, 470, '#496250');
      for (let y = top + 35; y < 900; y += 37)
        line(x, y, x + 28, y + 3, '#29483f');
      polygon(
        [
          [x, top],
          [x + 10, top + 8],
          [x + 5, top + 29],
          [x + 18, top + 41],
          [x + 7, top + 57],
        ],
        '#233f38',
      );
    }
  }
  if (layer === 'all' || layer === 'near') {
    for (let i = 0; i < 9; i++) {
      const x = i * 155 + 15,
        top = 115 + hash(i, 140) * 270,
        base = rgb('#173a32');
      polygon(
        [
          [x - 24, 960],
          [x - 7, top],
          [x + 16, top],
          [x + 43, 960],
        ],
        base,
      );
      line(x - 5, top + 55, x - 65, top - 7, base, 10);
      line(x + 8, top + 100, x + 80, top + 20, base, 10);
      for (let k = 0; k < 9; k++) {
        const cx = x - 70 + hash(k, i + 151) * 170,
          cy = top - 60 + hash(i, k + 153) * 98;
        foliage(cx, cy, 30 + hash(i, k + 154) * 33, 21, '#173a32');
        foliage(cx - 4, cy - 7, 20, 10, '#214439');
      }
      for (let k = 0; k < 6; k++) {
        const y = top + 60 + k * 90;
        line(x + 2, y, x - 1, y + 50, '#284b3b', 2);
        line(x + 13, y + 35, x + 17, y + 70, '#102d2a', 2);
      }
      for (let k = 0; k < 10; k++) {
        const y = top + 40 + hash(k, i + 169) * 500;
        ellipse(x + hash(i, k + 170) * 18 - 3, y, 3, 6, '#36533b');
      }
    }
    polygon(
      [
        [0, 895],
        [95, 862],
        [210, 909],
        [350, 877],
        [480, 915],
        [640, 870],
        [780, 910],
        [940, 879],
        [1120, 908],
        [1280, 860],
        [1280, 960],
        [0, 960],
      ],
      '#15352f',
    );
    for (let i = 0; i < 110; i++) {
      const x = hash(i, 180) * 1280,
        y = 855 + hash(i, 181) * 95;
      line(x, y, x - 7, y - 14, '#274738', 2);
      line(x - 2, y - 5, x + 8, y - 12, '#274738');
    }
  }
  const source = Buffer.from(im.png.data);
  for (let y = 0; y < 960; y++)
    for (let edge = 0; edge < 64; edge++) {
      const weight = (1 - edge / 64) ** 2;
      const left = (y * 1280 + edge) * 4,
        right = (y * 1280 + 1279 - edge) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const mean = (source[left + channel] + source[right + channel]) / 2;
        im.png.data[left + channel] = Math.round(
          source[left + channel] * (1 - weight) + mean * weight,
        );
        im.png.data[right + channel] = Math.round(
          source[right + channel] * (1 - weight) + mean * weight,
        );
      }
    }
  return im.png;
}
function specialTile(id) {
  const im = image(64, 64),
    { rect, line, ellipse, polygon, pixel } = im;
  if ([4, 5, 11].includes(id)) {
    const base =
      id === 4 ? rgb('#8db7bb') : id === 5 ? rgb('#56412f') : rgb('#938571');
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++)
        pixel(
          x,
          y,
          tint(base, (noise(x, y, 10) - 0.5) * 22 + (hash(x, y) - 0.5) * 8),
        );
  }
  if (id === 4) {
    rect(0, 0, 64, 3, '#d6e7d4');
    for (let i = 0; i < 6; i++) {
      const x = i * 13 - 10;
      line(x, 0, x + 28, 64, '#b9d7d0', 2);
    }
    line(12, 19, 35, 31, '#668e99');
    line(35, 31, 30, 49, '#668e99');
    line(35, 31, 53, 24, '#cee5db');
  }
  if (id === 5) {
    rect(0, 0, 64, 4, '#7b6543');
    for (let i = 0; i < 12; i++) {
      const x = hash(i, 20) * 64,
        y = 6 + hash(i, 21) * 54;
      ellipse(x, y, 7, 2, '#342f27');
      line(x - 5, y - 2, x + 2, y - 2, '#88704c');
    }
  }
  if (id === 6) {
    rect(4, 47, 56, 17, '#565b50');
    rect(6, 48, 52, 3, '#aaa884');
    for (let y = 16; y < 49; y += 8) {
      line(17, y, 45, y + 5, '#dad8b0', 3);
      line(45, y + 5, 17, y + 8, '#686e60', 3);
    }
    rect(1, 3, 62, 13, '#9b7236');
    rect(1, 3, 62, 4, '#e5c36d');
    rect(5, 8, 54, 4, '#cba257');
  }
  if (id === 7) {
    rect(0, 57, 64, 7, '#5c6158');
    for (let x = 1; x < 64; x += 16) {
      polygon(
        [
          [x, 57],
          [x + 7, 18],
          [x + 15, 57],
        ],
        '#879087',
      );
      polygon(
        [
          [x, 57],
          [x + 7, 18],
          [x + 7, 55],
        ],
        '#d4d3bb',
      );
      line(x + 7, 26, x + 8, 48, '#f1e4ca');
    }
  }
  if (id === 8) {
    rect(0, 0, 64, 16, '#785b3e');
    rect(0, 0, 64, 3, '#c5aa72');
    for (let x = 0; x < 64; x += 16) {
      line(x, 3, x + 2, 14, '#473d30');
      pixel(x + 8, 6, '#dfcda0');
    }
    line(4, 9, 60, 10, '#a58150');
  }
  if (id === 9 || id === 10) {
    rect(0, 0, 64, 64, '#505d58');
    rect(0, 0, 64, 8, '#a0aca0');
    rect(0, 8, 64, 11, '#273d3c');
    for (let x = 5; x < 64; x += 16) {
      ellipse(x, 13, 5, 5, '#78918a');
      ellipse(x, 13, 2, 2, '#c8cbb0');
    }
    for (let x = 0; x < 64; x += 16) {
      const flip = id === 9 ? -1 : 1,
        c = x + 8;
      line(c - flip * 3, 3, c + flip * 2, 5, '#3d655e', 2);
      line(c + flip * 2, 5, c - flip * 3, 7, '#3d655e', 2);
    }
    rect(4, 24, 56, 35, '#68786b');
    for (let y = 30; y < 56; y += 7) line(10, y, 53, y, '#3b514b');
  }
  if (id === 11) {
    rect(0, 0, 64, 3, '#c3b28d');
    line(16, 0, 24, 22, '#3c453e', 2);
    line(24, 22, 43, 30, '#3c453e', 2);
    line(43, 30, 36, 49, '#3c453e', 2);
    line(36, 49, 52, 64, '#3c453e', 2);
    line(24, 22, 4, 38, '#3c453e', 2);
    line(43, 30, 64, 18, '#3c453e', 2);
    line(36, 49, 10, 61, '#3c453e', 2);
  }
  if (id === 12) {
    const stone = earthSurface('stone');
    for (let y = 32; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const source = ((y - 32) * 64 + x) * 4;
        pixel(x, y, [...stone.data.subarray(source, source + 3)]);
      }
    rect(0, 32, 64, 2, '#a2a88c');
    rect(0, 61, 64, 3, '#424f43');
  }
  return im.png;
}
function animatedExplorer(state, frame) {
  const im = image(64, 64),
    { rect, line, polygon, ellipse, pixel } = im,
    base = explorer();
  const phase = (frame / 24) * Math.PI * 4,
    walk = state === 'walk' || state === 'sneak-walk',
    crouch = state.startsWith('sneak'),
    dash = state === 'dash',
    air = state === 'jump' || state === 'fall';
  const bob = walk
    ? Math.round(Math.abs(Math.sin(phase)) * 1)
    : Math.round(Math.sin((frame / 24) * Math.PI * 2));
  // Poses are drawn anatomically: bent knees/hips and translated head, never a vertically squeezed frame.
  if (crouch) {
    polygon(
      [
        [14, 49],
        [34, 47],
        [44, 56],
        [36, 61],
        [16, 58],
      ],
      '#9c804f',
    );
    line(16, 50, 33, 49, '#d2b576', 2);
    polygon(
      [
        [18, 57],
        [32, 57],
        [36, 61],
        [25, 63],
        [17, 62],
      ],
      '#3a4839',
    );
    polygon(
      [
        [30, 58],
        [42, 57],
        [47, 61],
        [42, 63],
        [32, 62],
      ],
      '#44513d',
    );
    const shift = walk ? Math.round(Math.sin(phase) * 3) : 0;
    rect(16 + shift, 62, 15, 2, '#3c3128');
    rect(35 - shift, 62, 16, 2, '#3c3128');
    for (let y = 0; y < 27; y++)
      for (let x = 0; x < 64; x++) {
        const at = (y * 64 + x) * 4;
        if (base.data[at + 3])
          pixel(x + 6, y + 32 - bob, [...base.data.subarray(at, at + 3)]);
      }
    line(43, 55, 49, 61, '#c5a06d', 4);
    line(18, 50, 33, 59, '#586445', 2);
  } else {
    const motion = Math.sin((frame / clips[state].frames) * Math.PI * 2),
      progress = frame / Math.max(1, clips[state].frames - 1);
    const lean = dash ? 6 + Math.round(motion) : 0,
      headY = dash
        ? 10 + Math.round(motion)
        : air
          ? -1 + Math.round(motion)
          : bob;
    const swing = walk
      ? Math.sin(phase) * 8
      : state === 'jump'
        ? 7 + progress * 5
        : state === 'fall'
          ? 2 + motion * 2
          : dash
            ? -10 + motion * 3
            : 0;
    polygon(
      [
        [22, 43],
        [31, 44],
        [28 + swing, 59],
        [19 + swing, 59],
      ],
      '#3c4c3b',
    );
    polygon(
      [
        [34, 43],
        [43, 43],
        [45 - swing, 59],
        [35 - swing, 60],
      ],
      '#2c3e33',
    );
    rect(18 + swing, 59, 14, 5, '#4a392b');
    rect(34 - swing, 59, 15, 5, '#4a392b');
    line(19 + swing, 59, 30 + swing, 59, '#9a7c51');
    line(35 - swing, 59, 46 - swing, 59, '#8b704c');
    polygon(
      [
        [19 + lean, 28 + headY],
        [41 + lean, 28 + headY],
        [45, 46],
        [20, 48],
        [16 + lean, 36 + headY],
      ],
      '#a07b42',
    );
    polygon(
      [
        [20 + lean, 29 + headY],
        [30 + lean, 30 + headY],
        [27, 46],
        [20, 46],
        [17 + lean, 36 + headY],
      ],
      '#c7a66a',
    );
    line(22 + lean, 29 + headY, 39, 44, '#40503a', 3);
    line(23 + lean, 29 + headY, 39, 43, '#90905d');
    rect(20, 45, 24, 3, '#53432d');
    rect(29, 45, 5, 3, '#cab57c');
    const arm = walk
      ? Math.sin(phase) * 5
      : state === 'fall'
        ? -8 + motion * 3
        : state === 'jump'
          ? -5 - progress * 5
          : dash
            ? motion * 2
            : 0;
    line(43 + lean, 32 + headY, 46 - arm, 44 + headY, '#987947', 5);
    ellipse(48 - arm, 46 + headY, 3, 4, '#d1ad78');
    rect(12 + lean, 31 + headY, 7, 14, '#5b6242');
    line(13 + lean, 32 + headY, 13 + lean, 42, '#a4a16a');
    for (let y = 0; y < 28; y++)
      for (let x = 0; x < 64; x++) {
        const at = (y * 64 + x) * 4;
        if (base.data[at + 3])
          pixel(x + lean, y + headY, [...base.data.subarray(at, at + 3)]);
      }
  }
  return im.png;
}
function playerSheet(state, count) {
  const output = new PNG({ width: 64 * count, height: 64 });
  for (let i = 0; i < count; i++) {
    const frame = animatedExplorer(state, i);
    PNG.bitblt(frame, output, 0, 0, 64, 64, i * 64, 0);
  }
  return output;
}
function effectSheet(kind) {
  const sheet = new PNG({ width: 32 * 12, height: 32 }),
    index = effectNames.indexOf(kind),
    palette = [
      '#c8b68b',
      '#796047',
      '#b6e5e5',
      '#ffe5a2',
      '#a7a084',
      '#b9e6cf',
      '#d6f0c2',
    ];
  for (let frame = 0; frame < 12; frame++) {
    const im = image(32, 32),
      { pixel, ellipse, line } = im,
      progress = frame / 12;
    if (kind === 'ring' || kind === 'burst') {
      const radius = 2 + progress * 13;
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++) {
          const distance = Math.hypot(x - 16, y - 16);
          if (
            Math.abs(distance - radius) <
            (kind === 'burst' ? 3 * (1 - progress) : 1.2)
          )
            pixel(x, y, tint(rgb(palette[index]), -progress * 35));
        }
      if (kind === 'burst' && frame < 4) {
        line(0, 16, 31, 16, palette[index]);
        line(16, 0, 16, 31, palette[index]);
      }
    } else if (kind === 'spark') {
      line(16, 4 + progress * 9, 16, 28 - progress * 9, palette[index], 2);
      line(10 + progress * 4, 16, 22 - progress * 4, 16, palette[index]);
    } else {
      const r = (1 - progress) * (kind === 'dust' ? 10 : 7) + 1;
      ellipse(16, 16, r, r * 0.7, palette[index]);
      for (let i = 0; i < 5; i++)
        ellipse(
          10 + hash(i, index) * 12,
          11 + hash(index, i) * 10,
          r * 0.4,
          r * 0.35,
          tint(rgb(palette[index]), i % 2 ? 18 : -12),
        );
    }
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const at = (y * 32 + x) * 4;
        if (im.png.data[at + 3])
          im.png.data[at + 3] = Math.round(255 * (1 - progress * 0.9));
      }
    PNG.bitblt(im.png, sheet, 0, 0, 32, 32, frame * 32, 0);
  }
  return sheet;
}
function timedSpikes(phase) {
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
    points = [];
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
export const assetManifest = {
  version: 2,
  backgrounds: ['sky', 'distant', 'midground', 'near'].map((name) => ({
    file: `background-${name}.png`,
    width: 1280,
    height: 960,
  })),
  traps: {
    crumble: {
      file: 'trap-crumble.png',
      frames: 12,
      fps: 24,
      width: 64,
      height: 64,
    },
    saw: { file: 'entity-saw.png', frames: 12, fps: 24, width: 64, height: 64 },
  },
  player: Object.fromEntries(
    Object.entries(clips).map(([name, clip]) => [
      name,
      { ...clip, file: `player-${name}.png`, fps: 24, width: 64, height: 64 },
    ]),
  ),
  effects: Object.fromEntries(
    effectNames.map((name) => [
      name,
      {
        file: `effect-${name}.png`,
        frames: 12,
        fps: 24,
        loop: false,
        width: 32,
        height: 32,
      },
    ]),
  ),
};
export function generateAssets() {
  const images = [
    ['grass', earthSurface('grass')],
    ['dirt', earthSurface('dirt')],
    ['stone', earthSurface('stone')],
    ['player', explorer()],
    ['portal', ancientGate()],
    ['background', forest()],
    ...['sky', 'distant', 'midground', 'near'].map((name) => [
      `background-${name}`,
      forest(name),
    ]),
    ['timed-spikes', timedSpikes('active')],
    ['timed-spikes-retracted', timedSpikes('retracted')],
    ['timed-spikes-warning', timedSpikes('warning')],
    ['crumble', specialTile(11)],
    ['trap-crumble', crumbleSheet()],
    ['saw', sawSprite()],
    ['entity-saw', sawSheet()],
    ['checkpoint', flag()],
    ['checkpoint-active', flag(true)],
  ];
  for (const [id, name] of [
    [4, 'ice'],
    [5, 'mud'],
    [6, 'spring'],
    [7, 'spikes'],
    [8, 'oneway'],
    [9, 'conveyor-left'],
    [10, 'conveyor-right'],
    [11, 'breakable'],
    [12, 'slab'],
  ])
    images.push([name, specialTile(id)]);
  for (const [name, clip] of Object.entries(clips))
    images.push([`player-${name}`, playerSheet(name, clip.frames)]);
  for (const name of effectNames)
    images.push([`effect-${name}`, effectSheet(name)]);
  return Object.fromEntries(
    images.map(([name, png]) => [name, PNG.sync.write(png)]),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const folder = new URL('../public/assets/', import.meta.url);
  mkdirSync(folder, { recursive: true });
  const assets = generateAssets();
  for (const [name, data] of Object.entries(assets))
    writeFileSync(new URL(`${name}.png`, folder), data);
  writeFileSync(
    new URL('manifest.json', folder),
    JSON.stringify(assetManifest),
  );
  process.stdout.write(
    `Generated ${Object.keys(assets).length} deterministic PNG assets and manifest.\n`,
  );
}
