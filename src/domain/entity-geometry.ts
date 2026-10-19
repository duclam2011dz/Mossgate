import type { Entity, PointTuple } from './contracts.ts';
import { enemyDefinitions } from './enemy-definitions.ts';
export function entityAnchor(entity: Entity): PointTuple {
  if (entity.type === 'checkpoint') return entity.position;
  if (entity.type === 'enemy') return entity.spawn;
  return entity.path[0] ?? [0, 0];
}
/** Translation preserves every waypoint; callers decide whether IDs are retained. */
export function translateEntity(
  entity: Entity,
  dx: number,
  dy: number,
): Entity {
  const point = ([x, y]: PointTuple): PointTuple => [x + dx, y + dy];
  if (entity.type === 'checkpoint')
    return { ...entity, position: point(entity.position) };
  if (entity.type === 'saw') return { ...entity, path: entity.path.map(point) };
  return {
    ...entity,
    spawn: point(entity.spawn),
    patrol: entity.patrol.map(point),
    ...(entity.overrides ? { overrides: { ...entity.overrides } } : {}),
  };
}
export function entityFits(entity: Entity, width: number, height: number) {
  const points =
    entity.type === 'checkpoint'
      ? [entity.position]
      : entity.type === 'saw'
        ? entity.path
        : [entity.spawn, ...entity.patrol];
  return points.every(([x, y]) => {
    if (entity.type === 'checkpoint')
      return x >= 5 && x + 5 <= width * 16 && y >= 14 && y <= height * 16;
    if (entity.type === 'saw')
      return (
        x >= entity.radius &&
        x + entity.radius <= width * 16 &&
        y >= entity.radius &&
        y + entity.radius <= height * 16
      );
    const stats = enemyDefinitions[entity.species];
    return (
      x >= 0 &&
      y >= 0 &&
      x + stats.w <= width * 16 &&
      y + stats.h <= height * 16
    );
  });
}
