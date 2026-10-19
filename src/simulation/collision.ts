import type {
  DraftMap,
  Box,
  CollisionRuntime,
  TileContact,
} from '../domain/contracts.ts';
import type { Player } from '../domain/player.ts';
type SupportBody = Box & Partial<Pick<Player, 'dropKey' | 'dropTimer'>>;
import { config } from '../shared/config.ts';
import { tiles } from '../domain/tiles.ts';
import { resolvedBox, resolveProperties } from '../domain/properties.ts';
import { spikePhase } from '../domain/entities.ts';

export class CollisionSystem {
  static solidTiles(
    this: void,
    level: DraftMap,
    box: Box,
    run?: CollisionRuntime,
  ): TileContact[] {
    return nearbyTiles(level, box, run).filter((b) =>
      ['solid', 'oneway'].includes(tiles[b.id]?.kind ?? 'empty'),
    );
  }
  static hazards(
    this: void,
    level: DraftMap,
    box: Box,
    run?: CollisionRuntime,
  ): TileContact[] {
    return nearbyTiles(level, box, run).filter(
      (b) =>
        tiles[b.id]?.kind === 'hazard' &&
        b.props.hazard &&
        (b.id !== 13 || !run || spikePhase(b.props, run.trapTime) === 'active'),
    );
  }
  static supported(
    this: void,
    level: DraftMap,
    p: SupportBody,
    run?: CollisionRuntime,
  ) {
    return !!supportTile(level, p, run);
  }
  static overlaps(this: void, a: Box, b: Box) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }
  static nearbyTiles(
    this: void,
    level: DraftMap,
    box: Box,
    run?: CollisionRuntime,
  ): TileContact[] {
    const found: TileContact[] = [],
      t = config.tile;
    for (
      let y = Math.max(0, Math.floor(box.y / t));
      y <=
      Math.min(level.height - 1, Math.floor((box.y + box.h - 0.00001) / t));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(box.x / t));
        x <=
        Math.min(level.width - 1, Math.floor((box.x + box.w - 0.00001) / t));
        x++
      ) {
        const id = level.tiles[y]?.[x],
          key = y * level.width + x;
        if (!id || run?.broken?.has(key) || run?.crumble?.get(key)?.missing)
          continue;
        const b = {
          ...resolvedBox(level, id, x, y),
          props: resolveProperties(level, id, x, y),
          id,
          key,
          col: x,
          row: y,
        };
        if (overlaps(box, b)) found.push(b);
      }
    return found;
  }
  static supportTile(
    this: void,
    level: DraftMap,
    p: SupportBody,
    run?: CollisionRuntime,
  ) {
    const foot = { x: p.x, y: p.y + p.h - 0.001, w: p.w, h: 1.001 };
    const candidates = solidTiles(level, foot, run).filter(
      (b) =>
        p.y + p.h <= b.y + 0.01 &&
        !(b.id === 8 && p.dropKey === b.key && (p.dropTimer ?? 0) > 0),
    );
    const center = p.x + p.w / 2;
    return (
      candidates.sort(
        (a, b) =>
          Math.max(a.x - center, center - a.x - a.w, 0) -
          Math.max(b.x - center, center - b.x - b.w, 0),
      )[0] || null
    );
  }
  static moveAxis(
    this: void,
    level: DraftMap,
    p: Player,
    axis: 'x' | 'y',
    amount: number,
    run?: CollisionRuntime,
  ) {
    const count = Math.max(1, Math.ceil(Math.abs(amount) / 4)),
      increment = amount / count;
    let hit = false;
    for (let i = 0; i < count; i++) {
      const oldFeet = p.y + p.h;
      p[axis] += increment;
      if (hazards(level, p, run).length) p.hitHazard = true;
      for (const b of solidTiles(level, p, run)) {
        if (
          b.id === 8 &&
          (axis !== 'y' ||
            increment <= 0 ||
            oldFeet > b.y + 0.01 ||
            (p.dropKey === b.key && (p.dropTimer ?? 0) > 0))
        )
          continue;
        if (
          b.id === 11 &&
          b.props.breakable &&
          axis === 'x' &&
          p.dash > 0 &&
          run
        ) {
          run.broken.add(b.key);
          run.events.push({
            type: 'break',
            x: b.x + b.w / 2,
            y: b.y + b.h / 2,
            id: b.id,
            key: b.key,
            properties: b.props,
          });
          continue;
        }
        p[axis] =
          axis === 'x'
            ? increment > 0
              ? b.x - p.w
              : b.x + b.w
            : increment > 0
              ? b.y - p.h
              : b.y + b.h;
        hit = true;
      }
      if (axis === 'x') {
        const x = Math.max(0, Math.min(level.width * 16 - p.w, p.x));
        if (x !== p.x) {
          p.x = x;
          hit = true;
        }
      }
      if (hit) break;
    }
    return hit;
  }
}
export const overlaps = CollisionSystem.overlaps;
export const nearbyTiles = CollisionSystem.nearbyTiles;
export const supportTile = CollisionSystem.supportTile;
export const moveAxis = CollisionSystem.moveAxis;

export const solidTiles = CollisionSystem.solidTiles;
export const hazards = CollisionSystem.hazards;
export const supported = CollisionSystem.supported;
