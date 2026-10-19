import { earthSurface, specialTile } from './core/motifs.ts';
export class TerrainGenerator {
  static generate() {
    return {
      grass: earthSurface('grass'),
      dirt: earthSurface('dirt'),
      stone: earthSurface('stone'),
      ...Object.fromEntries(
        (
          [
            [4, 'ice'],
            [5, 'mud'],
            [6, 'spring'],
            [7, 'spikes'],
            [8, 'oneway'],
            [9, 'conveyor-left'],
            [10, 'conveyor-right'],
            [11, 'breakable'],
            [12, 'slab'],
          ] satisfies [number, string][]
        ).map(([id, name]) => [name, specialTile(id)]),
      ),
    };
  }
}
