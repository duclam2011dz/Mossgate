import type {
  DraftMap,
  TileProperties,
  PropertyName,
  PropertyPatch,
} from './contracts.ts';
import { Guards } from '../shared/guards.ts';
type Field =
  | { label: string; type: 'boolean' }
  | { label: string; type: 'color' }
  | { label: string; min: number; max: number; step: number; type?: never };
import { tiles, tileBox } from './tiles.ts';
const cache = new WeakMap<
  DraftMap,
  { revision: number; values: Map<string, Readonly<TileProperties>> }
>();
export const properties: Record<PropertyName, Field> = {
  speed: { label: 'Speed multiplier', min: 0, max: 3, step: 0.05 },
  acceleration: {
    label: 'Acceleration multiplier',
    min: 0,
    max: 5,
    step: 0.05,
  },
  friction: { label: 'Friction multiplier', min: 0, max: 5, step: 0.05 },
  springForce: { label: 'Spring force', min: 100, max: 700, step: 10 },
  conveyor: { label: 'Conveyor speed', min: -160, max: 160, step: 5 },
  hazard: { label: 'Hazard enabled', type: 'boolean' },
  breakable: { label: 'Dash break enabled', type: 'boolean' },
  offsetX: { label: 'Hitbox X', min: 0, max: 15, step: 0.5 },
  offsetY: { label: 'Hitbox Y', min: 0, max: 15, step: 0.5 },
  width: { label: 'Hitbox width', min: 1, max: 16, step: 0.5 },
  height: { label: 'Hitbox height', min: 1, max: 16, step: 0.5 },
  effectsColor: { label: 'Effect color', type: 'color' },
  effectsIntensity: { label: 'Effect intensity', min: 0, max: 2, step: 0.1 },
  safeTime: { label: 'Safe time (s)', min: 0.1, max: 30, step: 0.1 },
  warningTime: { label: 'Warning time (s)', min: 0.1, max: 30, step: 0.1 },
  activeTime: { label: 'Active time (s)', min: 0.1, max: 30, step: 0.1 },
  delay: { label: 'Collapse delay (s)', min: 0.1, max: 30, step: 0.1 },
  downtime: { label: 'Recovery time (s)', min: 0.1, max: 30, step: 0.1 },
  phase: { label: 'Cycle phase', min: 0, max: 1, step: 0.05 },
};

export class PropertyResolver {
  static fieldsFor(this: void, id: number): PropertyName[] {
    const t = tiles[id];
    if (!t || !id) return [];
    const fields: PropertyName[] = [
      ...(t.kind === 'solid'
        ? (['speed', 'acceleration', 'friction'] as const)
        : []),
      ...(id === 6 ? (['springForce'] as const) : []),
      ...([9, 10].includes(id) ? (['conveyor'] as const) : []),
      ...([7, 13].includes(id) ? (['hazard'] as const) : []),
      ...(id === 11 ? (['breakable'] as const) : []),
      'offsetX',
      'offsetY',
      'width',
      'height',
      'effectsColor',
      'effectsIntensity',
      ...(id === 13
        ? (['safeTime', 'warningTime', 'activeTime', 'phase'] as const)
        : id === 14
          ? (['delay', 'warningTime', 'downtime'] as const)
          : []),
    ];
    return fields;
  }
  static baseProperties(this: void, id: number): TileProperties {
    const t = tiles[id];
    if (!t) throw new Error('Unknown tile ID');
    const b = tileBox(id, 0, 0);
    return {
      speed: t.speed ?? 1,
      acceleration: t.acceleration ?? 1,
      friction: t.friction ?? 1,
      springForce: 420,
      conveyor: t.conveyor ?? 0,
      hazard: t.kind === 'hazard',
      breakable: id === 11,
      offsetX: b.x,
      offsetY: b.y,
      width: b.w,
      height: b.h,
      effectsColor: t.color,
      effectsIntensity: 1,
      safeTime: 1.2,
      warningTime: id === 14 ? 0.3 : 0.4,
      activeTime: 1,
      delay: 0.8,
      downtime: 2,
      phase: 0,
    };
  }
  static invalidateProperties(this: void, level: DraftMap) {
    cache.delete(level);
    level.propertyRevision = (level.propertyRevision || 0) + 1;
  }
  static resolveProperties(
    this: void,
    level: DraftMap,
    id: number,
    x?: number,
    y?: number,
  ): Readonly<TileProperties> {
    let memo = cache.get(level);
    if (!memo || memo.revision !== (level.propertyRevision || 0)) {
      memo = { revision: level.propertyRevision || 0, values: new Map() };
      cache.set(level, memo);
    }
    const key = `${id}:${x === undefined ? 'type' : x + ',' + y}`;
    const existing = memo.values.get(key);
    if (existing) return existing;
    const value = Object.freeze({
      ...baseProperties(id),
      ...(level.tileDefaults?.[id] || {}),
      ...(x === undefined ? {} : level.cellOverrides?.[`${x},${y}`] || {}),
    });
    memo.values.set(key, value);
    return value;
  }
  static validatePatch(
    this: void,
    id: number,
    patch: unknown,
    inherited: TileProperties = baseProperties(id),
  ): TileProperties {
    if (!Guards.record(patch)) throw new Error('Invalid property patch.');
    const allowed = fieldsFor(id);
    for (const [name, value] of Object.entries(patch)) {
      if (!Object.hasOwn(properties, name))
        throw new Error(`Unsupported property: ${name}`);
      const key = name as PropertyName;
      const field = properties[key];
      if (!allowed.includes(key) || !field)
        throw new Error(`Unsupported property: ${name}`);
      if (field.type === 'boolean') {
        if (typeof value !== 'boolean') throw new Error(`Invalid ${name}`);
      } else if (field.type === 'color') {
        if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
          throw new Error('Invalid effect color');
      } else if (
        !Guards.number(value) ||
        value < field.min ||
        value > field.max ||
        (name.match(/^(offsetX|offsetY|width|height)$/) &&
          Math.abs(value * 2 - Math.round(value * 2)) > 1e-8)
      )
        throw new Error(`Invalid ${name}`);
    }
    // Each whitelisted field was checked against its runtime descriptor above.
    const value = { ...inherited, ...patch };
    if (value.offsetX + value.width > 16 || value.offsetY + value.height > 16)
      throw new Error('Hitbox must stay inside its tile.');
    if (id === 14 && value.warningTime > value.delay)
      throw new Error('Warning cannot exceed collapse delay.');
    return value;
  }
  static sparsePatch(
    this: void,
    id: number,
    patch: unknown,
    inherited: TileProperties = baseProperties(id),
  ): PropertyPatch {
    const checked = validatePatch(id, patch, inherited);
    if (!Guards.record(patch)) throw new Error('Invalid property patch');
    return Object.fromEntries(
      Object.keys(patch)
        .sort()
        .filter(
          (k) => checked[k as PropertyName] !== inherited[k as PropertyName],
        )
        .map((k) => [k, patch[k]]),
    );
  }
  static resolvedBox(
    this: void,
    level: DraftMap,
    id: number,
    x: number,
    y: number,
  ) {
    const p = resolveProperties(level, id, x, y);
    return {
      x: x * 16 + p.offsetX,
      y: y * 16 + p.offsetY,
      w: p.width,
      h: p.height,
    };
  }
}
export const fieldsFor = PropertyResolver.fieldsFor;
export const baseProperties = PropertyResolver.baseProperties;
export const invalidateProperties = PropertyResolver.invalidateProperties;
export const resolveProperties = PropertyResolver.resolveProperties;
export const validatePatch = PropertyResolver.validatePatch;
export const sparsePatch = PropertyResolver.sparsePatch;
export const resolvedBox = PropertyResolver.resolvedBox;
