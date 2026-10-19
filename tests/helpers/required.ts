import { tiles } from '../../src/domain/tiles.ts';
import type { TileId } from '../../src/domain/contracts.ts';
export function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error('Required test fixture value is missing.');
  return value;
}
export function tileId(value: number): TileId {
  if (!Number.isInteger(value) || !tiles[value])
    throw new Error('Invalid fixture tile ID');
  return value as TileId;
}
