import { MapCodec } from '../domain/map-codec.js';
import { solidTiles, supported, hazards } from './collision.js';
import { sweptSaw } from '../domain/entities.js';

export class MapValidator {
  static decodeLevel(data, options = {}) {
    const level = MapCodec.decodeLevel(data, options);
    if (!options.draft) {
      const errors = MapValidator.playErrors(level);
      if (errors.length) throw new Error('Invalid map: ' + errors.join(' '));
    }
    return level;
  }

  static playErrors(level) {
    const problems = [];
    const sawCrosses = (box) =>
      (level.entities || []).some((e) => {
        if (e.type !== 'saw') return false;
        const points = e.mode === 'loop' ? [...e.path, e.path[0]] : e.path;
        return points
          .slice(1)
          .some((b, i) =>
            sweptSaw(
              { x: points[i][0], y: points[i][1] },
              { x: b[0], y: b[1] },
              e.radius,
              box,
              box,
            ),
          );
      });
    for (const [name, box] of [
      ['Spawn', level.spawn ? { ...level.spawn, w: 10, h: 14 } : null],
      ['Portal', level.portal],
    ]) {
      if (!box) {
        problems.push(`${name} is not placed.`);
        continue;
      }
      if (
        solidTiles(level, box).some((b) => b.id !== 8) ||
        !supported(level, box) ||
        hazards(level, box).length ||
        sawCrosses(box)
      )
        problems.push(
          `${name} must be clear, supported, and away from spikes.`,
        );
    }
    for (const entity of level.entities || [])
      if (entity.type === 'checkpoint') {
        const box = {
          x: entity.position[0] - 5,
          y: entity.position[1] - 14,
          w: 10,
          h: 14,
        };
        if (
          solidTiles(level, box).some((b) => b.id !== 8) ||
          !supported(level, box) ||
          hazards(level, box).length ||
          sawCrosses(box)
        )
          problems.push(`Checkpoint ${entity.id} must be clear and supported.`);
      }
    return problems;
  }
}
export const playErrors = MapValidator.playErrors;
