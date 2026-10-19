import { readFileSync } from 'node:fs';
import type { WireMap } from '../../src/domain/contracts.ts';
import { MapValidator } from '../../src/simulation/map-validator.ts';
export const source = readFileSync(
  new URL('../../public/maps/forest-ruins-legacy.json', import.meta.url),
  'utf8',
);
const raw: unknown = JSON.parse(source);
export const level = MapValidator.decodeLevel(raw);
// Structural and playable validation above established the wire contract.
export const mapData = raw as WireMap;
export const segments = mapData.rects
  .filter((rect) => rect[4] === 1)
  .map(([x, y, w]): [number, number, number] => [x, x + w - 1, y]);
