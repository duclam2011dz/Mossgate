import { solidTiles } from '../../src/simulation/collision.ts';
import type { PlayableMap, Input } from '../../src/domain/contracts.ts';
import {
  GameSimulation,
  emptyInput,
} from '../../src/simulation/game-simulation.ts';
/** Legal controls only: no teleports, runtime mutations, or health overrides. */
export function wildwoodInput(run: GameSimulation, level: PlayableMap): Input {
  const p = run.player;
  const near = [...run.enemies.registry.actors.values()].some(
    (enemy) => !enemy.stats.flying && enemy.x > p.x - 20 && enemy.x < p.x + 65,
  );
  return {
    ...emptyInput(),
    axis: 1,
    jumpPressed:
      p.grounded &&
      (near ||
        solidTiles(level, { x: p.x + p.w + 2, y: p.y, w: 8, h: p.h }, run).some(
          (tile) => tile.id !== 8,
        )),
    jumpHeld: true,
    dashPressed: p.cooldown === 0,
  };
}
export function replayWildwood(
  run: GameSimulation,
  level: PlayableMap,
  inputs: Input[] = [],
) {
  for (let frame = 0; frame < 12000 && run.state === 'playing'; frame++) {
    const input = wildwoodInput(run, level);
    inputs.push(input);
    run.step(input);
  }
  return run;
}
