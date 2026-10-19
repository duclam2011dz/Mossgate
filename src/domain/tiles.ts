import type { TileId, TileKind, Box } from './contracts.ts';
export class Tile {
  readonly color: string;
  readonly speed?: number;
  readonly acceleration?: number;
  readonly friction?: number;
  readonly conveyor?: number;
  readonly description?: string;
  constructor(
    readonly id: TileId,
    readonly name: string,
    readonly asset: string | null,
    readonly kind: TileKind = 'solid',
    extra: {
      color?: string;
      speed?: number;
      acceleration?: number;
      friction?: number;
      conveyor?: number;
      description?: string;
    } = {},
  ) {
    this.color = extra.color ?? '#81705a';
    if (extra.speed !== undefined) this.speed = extra.speed;
    if (extra.acceleration !== undefined)
      this.acceleration = extra.acceleration;
    if (extra.friction !== undefined) this.friction = extra.friction;
    if (extra.conveyor !== undefined) this.conveyor = extra.conveyor;
    if (extra.description !== undefined) this.description = extra.description;
    Object.freeze(this);
  }
}
const tile = (...args: ConstructorParameters<typeof Tile>) => new Tile(...args);
export const tiles = Object.freeze([
  tile(0, 'Empty', null, 'empty', { color: '#f5f2e9' }),
  tile(1, 'Grass', 'grass', 'solid', { color: '#8a9c52' }),
  tile(2, 'Dirt', 'dirt'),
  tile(3, 'Stone', 'stone', 'solid', { color: '#798477' }),
  tile(4, 'Ice', 'ice', 'solid', {
    color: '#9dd6e0',
    acceleration: 0.2,
    friction: 0.2,
    description: 'Low grip and long slides.',
  }),
  tile(5, 'Mud', 'mud', 'solid', {
    color: '#68503c',
    speed: 0.5,
    acceleration: 0.6,
    description: 'Slows running and acceleration.',
  }),
  tile(6, 'Spring', 'spring', 'solid', {
    color: '#c5a64c',
    description: 'Bounces on landing, even while sneaking.',
  }),
  tile(7, 'Spikes', 'spikes', 'hazard', {
    color: '#ba6856',
    description: 'Touching the tips causes a respawn.',
  }),
  tile(8, 'One-way', 'oneway', 'oneway', {
    color: '#ba9b71',
    description: 'Jump through from below. S + W drops down.',
  }),
  tile(9, 'Conveyor left', 'conveyor-left', 'solid', {
    color: '#6e9c9c',
    conveyor: -45,
    description: 'Carries you to the left.',
  }),
  tile(10, 'Conveyor right', 'conveyor-right', 'solid', {
    color: '#6e9c9c',
    conveyor: 45,
    description: 'Carries you to the right.',
  }),
  tile(11, 'Breakable', 'breakable', 'solid', {
    color: '#b19a79',
    description: 'Dash into its side to break it.',
  }),
  tile(12, 'Stone slab', 'slab', 'solid', {
    color: '#798477',
    description: 'An eight-unit lower slab for crawl spaces.',
  }),
  tile(13, 'Timed spikes', 'timed-spikes', 'hazard', {
    color: '#bc7b51',
    description: 'Retracts, warns, then extends. Watch the amber warning.',
  }),
  tile(14, 'Crumbling platform', 'crumble', 'solid', {
    color: '#a89a69',
    description: 'Collapses after landing, then returns when clear.',
  }),
]);

export class TileRegistry {
  static get entries() {
    return tiles;
  }
  static tileBox(this: void, id: number, x: number, y: number): Box {
    return {
      x: x * 16 + ([7, 13].includes(id) ? 2 : 0),
      y: y * 16 + (id === 12 ? 8 : [7, 13].includes(id) ? 5 : 0),
      w: [7, 13].includes(id) ? 12 : 16,
      h: id === 12 ? 8 : id === 8 ? 4 : [7, 13].includes(id) ? 11 : 16,
    };
  }
}
export const tileBox = TileRegistry.tileBox;
