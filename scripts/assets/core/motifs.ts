import { image, rgb, tint, hash, noise } from './raster.ts';
export function earthSurface(name: string) {
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
export function explorer() {
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
export function specialTile(id: number) {
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
