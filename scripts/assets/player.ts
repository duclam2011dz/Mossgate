import { PNG } from 'pngjs';
import { clips } from '../../src/shared/asset-definitions.ts';
import { explorer } from './core/motifs.ts';
import { image } from './core/raster.ts';
type ClipName = keyof typeof clips;
function animatedExplorer(state: ClipName, frame: number) {
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
function playerSheet(state: ClipName, count: number) {
  const output = new PNG({ width: 64 * count, height: 64 });
  for (let i = 0; i < count; i++) {
    const frame = animatedExplorer(state, i);
    PNG.bitblt(frame, output, 0, 0, 64, 64, i * 64, 0);
  }
  return output;
}
export class PlayerGenerator {
  static generate() {
    return {
      player: explorer(),
      ...Object.fromEntries(
        (Object.keys(clips) as ClipName[]).map((name) => [
          `player-${name}`,
          playerSheet(name, clips[name].frames),
        ]),
      ),
    };
  }
}
