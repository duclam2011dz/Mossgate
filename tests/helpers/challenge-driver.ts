import type { PlayableMap, Input } from '../../src/domain/contracts.ts';
import type { GameSimulation } from '../../src/simulation/game-simulation.ts';
interface ReplayMemory {
  crawlExit?: boolean;
  spring?: boolean;
  dashed?: boolean;
  jumpAt?: number;
  [key: `gate${number}`]: boolean;
}
import {
  emptyInput,
  step,
  createRun,
} from '../../src/simulation/game-simulation.ts';
import { supportTile } from '../../src/simulation/collision.ts';
export function challengeInput(
  run: GameSimulation,
  level: PlayableMap,
  memory: ReplayMemory,
) {
  const p = run.player,
    input = { ...emptyInput(), axis: 1, jumpHeld: true },
    x = p.x;
  const near = (a: number, b: number) => x >= a * 16 && x < b * 16;
  const edges = [
    14, 29, 44, 58, 73, 337, 345, 353, 361, 374, 389, 424, 440, 454, 470, 484,
  ];
  for (const edge of edges)
    if (x + p.w >= (edge + 1) * 16 - 10 && x < (edge + 1) * 16 && p.grounded)
      input.jumpPressed = true;
  if (x + p.w >= 82 * 16 - 8 && x < 85 * 16 && p.grounded)
    input.jumpPressed = true;
  input.sneak =
    near(128, 150) || near(416, 423) || near(430, 439.5) || near(462, 469);
  if (x >= 148 * 16 - 4 && x < 150 * 16 && p.grounded && !memory.crawlExit) {
    input.jumpPressed = true;
    memory.crawlExit = true;
  }
  if (near(162, 165) && !p.sneaking && p.cooldown === 0)
    input.dashPressed = true;
  if (near(215, 216) && p.grounded && !memory.spring) {
    input.jumpPressed = true;
    memory.spring = true;
  }
  const support = supportTile(level, p, run);
  if (support?.id === 8 && near(239, 245)) {
    input.down = true;
    input.jumpPressed = true;
  }
  if (input.jumpPressed) {
    memory.jumpAt = run.elapsed;
    memory.dashed = false;
  }
  const big =
    (x > 80 * 16 && x < 86 * 16) ||
    [424, 454, 484].some((edge) => x > (edge - 2) * 16 && x < (edge + 7) * 16);
  if (
    big &&
    !p.grounded &&
    !memory.dashed &&
    run.elapsed - (memory.jumpAt ?? 0) > 0.18 &&
    p.cooldown === 0
  ) {
    input.dashPressed = true;
    memory.dashed = true;
  }
  for (const [start, end, phase] of [
    [312, 315, 0],
    [496, 499, 0.1],
  ] satisfies [number, number, number][]) {
    const key: `gate${number}` = `gate${start}`;
    if (x >= (start - 2.5) * 16 && x < end * 16) {
      const cycle = 3.2,
        t = (run.trapTime + phase * cycle) % cycle;
      if (!memory[key] && t < 0.25) memory[key] = true;
      if (!memory[key]) input.axis = 0;
    }
  }
  return input;
}
export function replayChallenge(level: PlayableMap, maxFrames = 18000) {
  const run = createRun(level),
    memory: ReplayMemory = {},
    inputs: Input[] = [];
  for (let frame = 0; frame < maxFrames && run.state === 'playing'; frame++) {
    const input = challengeInput(run, level, memory);
    inputs.push(input);
    step(run, level, input);
    if (run.falls) break;
  }
  return { run, inputs };
}
