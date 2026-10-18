import { readFileSync } from 'node:fs';
import { decodeLevel } from '../../src/domain/map-codec.js';
export const source = readFileSync(
  new URL('../../public/maps/forest-ruins-legacy.json', import.meta.url),
  'utf8',
);
export const mapData = JSON.parse(source);
export const level = decodeLevel(mapData);
export const segments = mapData.rects
  .filter((rect) => rect[4] === 1)
  .map(([x, y, w]) => [x, x + w - 1, y]);
