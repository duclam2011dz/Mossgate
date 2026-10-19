import { PNG } from 'pngjs';
import { image, rgb, tint, hash, noise, SEED } from './core/raster.ts';
function forest(layer = 'all') {
  const im = image(1280, 960),
    { pixel, ellipse, polygon, line, rect } = im;
  function foliage(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string,
  ) {
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
        const mean =
          ((source[left + channel] ?? 0) + (source[right + channel] ?? 0)) / 2;
        im.png.data[left + channel] = Math.round(
          (source[left + channel] ?? 0) * (1 - weight) + mean * weight,
        );
        im.png.data[right + channel] = Math.round(
          (source[right + channel] ?? 0) * (1 - weight) + mean * weight,
        );
      }
    }
  return im.png;
}

export class BackgroundGenerator {
  private static sky(preset: 'day' | 'rain') {
    const result = image(1280, 960);
    for (let y = 0; y < 960; y++)
      for (let x = 0; x < 1280; x++) {
        const light = Math.max(
          0,
          1 - Math.hypot((x - 950) / 1000, (y - 100) / 1000),
        );
        const cloud = noise(x, y * 0.7, 110, SEED + 83);
        const shade =
          Math.round(
            (light * 14 +
              (cloud - 0.5) * (preset === 'day' ? 9 : 20) -
              y * 0.008) /
              2,
          ) * 2;
        result.pixel(
          x,
          y,
          tint(rgb(preset === 'day' ? '#91b6b1' : '#526b72'), shade),
        );
      }
    if (preset === 'day') {
      result.ellipse(966, 120, 67, 67, '#b8c9ad');
      result.ellipse(966, 120, 51, 51, '#d6d8b0');
      result.ellipse(966, 120, 37, 37, '#f6e9b6');
      result.ellipse(960, 114, 29, 29, '#fff0c8');
    }
    return result.png;
  }
  static generate() {
    const names = ['sky', 'distant', 'midground', 'near'] as const;
    const original = names.map((name) => forest(name));
    const result: Record<string, PNG> = { background: forest() };
    names.forEach((name, i) => {
      const layer = original[i];
      if (layer) result[`background-${name}`] = layer;
    });
    for (const preset of ['night', 'day', 'rain'] as const) {
      const atlas = new PNG({ width: 2560, height: 1920 });
      original.forEach((source, i) => {
        const layer = new PNG({ width: 1280, height: 960 });
        (i === 0 && preset !== 'night' ? this.sky(preset) : source).data.copy(
          layer.data,
        );
        if (preset !== 'night' && i !== 0)
          for (let y = 0; y < 960; y++)
            for (let x = 0; x < 1280; x++) {
              const at = (y * 1280 + x) * 4;
              if (!layer.data[at + 3]) continue;
              const r = layer.data[at] ?? 0,
                g = layer.data[at + 1] ?? 0,
                b = layer.data[at + 2] ?? 0;
              if (preset === 'day') {
                const light =
                  Math.max(0, 1 - Math.abs(((x + y * 0.22) % 430) - 215) / 80) *
                  0.24;
                layer.data[at] = Math.min(255, r * 1.55 + 25 + light * 24);
                layer.data[at + 1] = Math.min(255, g * 1.5 + 28 + light * 22);
                layer.data[at + 2] = Math.min(255, b * 1.35 + 15 + light * 10);
              } else {
                layer.data[at] = r * 0.85 + 12;
                layer.data[at + 1] = g * 0.9 + 14;
                layer.data[at + 2] = b * 1.05 + 23;
              }
            }
        // Blend a band, not just the edge pixel, so moving skies have no vertical seam.
        if (preset !== 'night') {
          const pixels = Buffer.from(layer.data);
          for (let y = 0; y < 960; y++)
            for (let edge = 0; edge < 64; edge++)
              for (let c = 0; c < 4; c++) {
                const left = (y * 1280 + edge) * 4 + c,
                  right = (y * 1280 + 1279 - edge) * 4 + c,
                  weight = (1 - edge / 64) ** 2;
                const mean = ((pixels[left] ?? 0) + (pixels[right] ?? 0)) / 2;
                layer.data[left] = Math.round(
                  (pixels[left] ?? 0) * (1 - weight) + mean * weight,
                );
                layer.data[right] = Math.round(
                  (pixels[right] ?? 0) * (1 - weight) + mean * weight,
                );
              }
        }
        PNG.bitblt(
          layer,
          atlas,
          0,
          0,
          1280,
          960,
          (i % 2) * 1280,
          Math.floor(i / 2) * 960,
        );
      });
      result[`background-${preset}-atlas`] = atlas;
    }
    return result;
  }
}
