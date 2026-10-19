import type { PlayableMap } from './contracts.ts';
export class Player {
  x: number;
  y: number;
  w = 10;
  h = 14;
  vx = 0;
  vy = 0;
  facing = 1;
  grounded = false;
  coyote = 0;
  buffer = 0;
  dash = 0;
  cooldown = 0;
  sneaking = false;
  dropKey: number | null = null;
  dropTimer = 0;
  springJump = false;
  travel = 0;
  hitHazard = false;
  constructor(level: Pick<PlayableMap, 'spawn'>) {
    this.x = level.spawn.x;
    this.y = level.spawn.y;
  }
}
