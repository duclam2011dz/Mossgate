import { PNG } from 'pngjs';
import { effectNames } from '../../src/shared/asset-definitions.ts';
import { image, tint, rgb, hash } from './core/raster.ts';
function effectSheet(kind: (typeof effectNames)[number]) {
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
            pixel(x, y, tint(rgb(palette[index] ?? '#c8b68b'), -progress * 35));
        }
      if (kind === 'burst' && frame < 4) {
        line(0, 16, 31, 16, palette[index] ?? '#c8b68b');
        line(16, 0, 16, 31, palette[index] ?? '#c8b68b');
      }
    } else if (kind === 'spark') {
      line(
        16,
        4 + progress * 9,
        16,
        28 - progress * 9,
        palette[index] ?? '#c8b68b',
        2,
      );
      line(
        10 + progress * 4,
        16,
        22 - progress * 4,
        16,
        palette[index] ?? '#c8b68b',
      );
    } else {
      const r = (1 - progress) * (kind === 'dust' ? 10 : 7) + 1;
      ellipse(16, 16, r, r * 0.7, palette[index] ?? '#c8b68b');
      for (let i = 0; i < 5; i++)
        ellipse(
          10 + hash(i, index) * 12,
          11 + hash(index, i) * 10,
          r * 0.4,
          r * 0.35,
          tint(rgb(palette[index] ?? '#c8b68b'), i % 2 ? 18 : -12),
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
export class EffectsGenerator {
  static generate() {
    return Object.fromEntries(
      effectNames.map((name) => [`effect-${name}`, effectSheet(name)]),
    );
  }
}
