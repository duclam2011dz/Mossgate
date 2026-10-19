import { PNG } from 'pngjs';
import { image, hash, rgb, tint } from './core/raster.ts';
const species = [
  'bramble-guard',
  'spore-pod',
  'root-charger',
  'thorn-wisp',
  'vine-moth',
  'bloom-sentinel',
] as const;
const states = [
  'idle',
  'move',
  'alert',
  'windup',
  'attack',
  'recover',
] as const;
/** Each species uses a distinct botanical silhouette; no external bitmap inputs. */
export class EnemyGenerator {
  static generate() {
    const output: Record<string, PNG> = {};
    species.forEach((name, kind) => {
      for (const state of states) {
        const sheet = new PNG({ width: 64 * 12, height: 64 });
        for (let frame = 0; frame < 12; frame++) {
          const im = image(64, 64),
            phase = (frame / 12) * Math.PI * 2;
          const flying = kind >= 3,
            bob = Math.sin(phase) * (state === 'move' ? 3 : 1);
          const cy = 32 + bob,
            glow =
              state === 'windup' || state === 'attack' ? '#fff7a1' : '#d6b753';
          const bark =
            kind === 1 ? '#72514a' : kind === 2 ? '#644334' : '#394c38';
          if (kind === 4) {
            for (const side of [-1, 1]) {
              im.ellipse(
                32 + side * 15,
                cy - 4,
                11 + Math.sin(phase) * 4,
                18,
                '#152d29',
              );
              im.ellipse(
                32 + side * 15,
                cy - 5,
                9 + Math.sin(phase) * 3,
                16,
                '#6b8b58',
              );
              for (let vein = 0; vein < 4; vein++)
                im.line(
                  32 + side * 4,
                  cy + 5,
                  32 + side * (16 + vein),
                  cy - 15 + vein * 8,
                  '#b2b373',
                  1,
                );
            }
          }
          if (kind === 5) {
            for (let petal = 0; petal < 7; petal++) {
              const a = (petal / 7) * Math.PI * 2 + Math.sin(phase) * 0.04;
              im.ellipse(
                32 + Math.cos(a) * 15,
                cy + Math.sin(a) * 15,
                8,
                11,
                '#2a3d36',
              );
              im.ellipse(
                31 + Math.cos(a) * 15,
                cy - 1 + Math.sin(a) * 15,
                6,
                9,
                '#9b7569',
              );
            }
          }
          if (kind === 3) {
            for (let thorn = 0; thorn < 6; thorn++) {
              const a = (thorn / 6) * Math.PI * 2;
              im.polygon(
                [
                  [32 + Math.cos(a) * 8, cy + Math.sin(a) * 8],
                  [32 + Math.cos(a) * 25, cy + Math.sin(a) * 23],
                  [32 + Math.cos(a + 0.6) * 10, cy + Math.sin(a + 0.6) * 10],
                ],
                '#6e9362',
              );
            }
          }
          if (!flying) {
            for (const side of [-1, 1]) {
              const step = state === 'move' ? Math.sin(phase + side) * 4 : 0;
              im.line(
                32 + side * 7,
                cy + 9,
                32 + side * 12 + step,
                58,
                '#1c2924',
                7,
              );
              im.line(
                31 + side * 7,
                cy + 9,
                31 + side * 12 + step,
                57,
                bark,
                4,
              );
              im.line(
                32 + side * 12 + step,
                57,
                32 + side * 18 + step,
                59,
                '#82906a',
                2,
              );
            }
          }
          im.ellipse(
            32,
            cy,
            kind === 2 ? 19 : 13,
            kind === 0 ? 22 : 16,
            '#152820',
          );
          im.ellipse(
            31,
            cy - 1,
            kind === 2 ? 17 : 11,
            kind === 0 ? 20 : 14,
            bark,
          );
          for (let n = 0; n < 75; n++) {
            const x = 22 + hash(n, kind) * 20,
              y = cy - 12 + hash(n, kind + 30) * 25;
            if (((x - 31) / 10) ** 2 + ((y - cy) / 14) ** 2 < 1)
              im.line(
                x,
                y,
                x + 1,
                y + 3,
                tint(rgb(bark), hash(n, kind + 50) * 50 - 15),
                1,
              );
          }
          if (kind === 1) {
            im.ellipse(32, cy - 13, 22, 11, '#342d2b');
            im.ellipse(31, cy - 15, 20, 9, '#a17662');
            for (let dot = 0; dot < 9; dot++)
              im.ellipse(
                16 + hash(dot, 2) * 30,
                cy - 19 + hash(dot, 3) * 7,
                2,
                2,
                '#d1b38a',
              );
          }
          if (kind === 0 || kind === 2) {
            for (const side of [-1, 1]) {
              const reach = state === 'attack' ? 24 : 17;
              im.line(
                32 + side * 9,
                cy - 5,
                32 + side * reach,
                cy + 8,
                '#17281e',
                6,
              );
              im.line(
                31 + side * 9,
                cy - 6,
                31 + side * reach,
                cy + 7,
                '#64714c',
                3,
              );
              im.line(
                32 + side * reach,
                cy + 5,
                32 + side * (reach + 5),
                cy - 4,
                '#a3a16f',
                2,
              );
            }
            im.line(25, cy - 18, 19, cy - 26, '#809263', 3);
            im.line(37, cy - 18, 43, cy - 25, '#809263', 3);
          }
          for (const x of [27, 36]) {
            im.ellipse(x, cy - 4, 4, 3, '#152322');
            im.line(x - 1, cy - 4, x + 1, cy - 4, glow, 2);
          }
          im.line(28, cy + 5, 35, cy + 6, '#c2ac78', 1);
          PNG.bitblt(im.png, sheet, 0, 0, 64, 64, frame * 64, 0);
          if (state === 'idle' && frame === 0)
            output[`enemy-${name}-preview`] = im.png;
        }
        output[`enemy-${name}-${state}`] = sheet;
      }
    });
    for (const [index, name] of [
      'spore',
      'thorn',
      'bloom',
      'poison',
      'slow',
    ].entries()) {
      const im = image(32, 32);
      for (let y = 5; y < 27; y++)
        for (let x = 5; x < 27; x++) {
          const distance = Math.hypot(x - 16, y - 16);
          if (distance < 10 && hash(x, y, index) > 0.35)
            im.pixel(x, y, distance > 8 ? '#405847' : '#65836b');
        }
      im.ellipse(16, 16, index === 1 ? 10 : 7, index === 1 ? 2 : 7, '#203b35');
      im.ellipse(
        15,
        15,
        index === 1 ? 8 : 5,
        index === 1 ? 1 : 5,
        index === 0 || index === 3 ? '#bdad74' : '#91ceaa',
      );
      for (let n = 0; n < 7; n++)
        im.pixel(
          12 + hash(n, index) * 8,
          12 + hash(n, index + 20) * 8,
          '#e1eabb',
        );
      output[`enemy-effect-${name}`] = im.png;
    }
    return output;
  }
}
