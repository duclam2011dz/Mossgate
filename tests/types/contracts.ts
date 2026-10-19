import type {
  DraftMap,
  PlayableMap,
  Entity,
  GameplayEvent,
  PropertyPatch,
} from '../../src/domain/contracts.ts';
import type { GameTestHooks } from '../../src/infrastructure/test-hooks.d.ts';
import { GameSimulation } from '../../src/simulation/game-simulation.ts';
// Compiled by the tooling group; never executed as runtime tests.
export function verifyContracts(
  draft: DraftMap,
  playable: PlayableMap,
  entity: Entity,
  event: GameplayEvent,
  hooks: GameTestHooks,
): void {
  new GameSimulation(playable);
  // @ts-expect-error A nullable draft cannot enter the simulation.
  new GameSimulation(draft);
  if (entity.type === 'saw') {
    const speed: number = entity.speed;
    void speed;
  } else {
    // @ts-expect-error Checkpoints have no saw path.
    void entity.path;
  }
  const patch: PropertyPatch = { speed: 0, hazard: false };
  void patch;
  // @ts-expect-error Runtime behavior kind is not an editable property.
  const invalid: PropertyPatch = { kind: 'hazard' };
  void invalid;
  // @ts-expect-error Events are a closed union.
  const invalidEvent: GameplayEvent = { ...event, type: 'unknown' };
  void invalidEvent;
  hooks.advance(1, { axis: 1 });
  // @ts-expect-error Input flags must be boolean.
  hooks.advance(1, { sneak: 1 });
}
