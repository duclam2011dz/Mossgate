import { LevelPackageCodec } from './level-package.ts';
import { BackgroundResources } from './background-resources.ts';
import type { DraftMap, PlayableMap } from '../domain/contracts.ts';
import { MapValidator } from '../simulation/map-validator.ts';
import { parseLevel, limits } from '../domain/map-codec.ts';
import { playErrors } from '../simulation/map-validator.ts';
export class MapFiles {
  static async readMapFile(
    this: void,
    file: File,
    options: { draft: true },
  ): Promise<DraftMap>;
  static async readMapFile(
    this: void,
    file: File,
    options?: { draft?: false },
  ): Promise<PlayableMap>;
  static async readMapFile(
    this: void,
    file: File,
    options?: { draft?: boolean },
  ): Promise<DraftMap> {
    if (!options?.draft || !file.name.toLowerCase().endsWith('.json')) {
      const pack = await LevelPackageCodec.decode(file);
      const level = options?.draft
        ? pack.level
        : MapValidator.playable(pack.level);
      level.background = await BackgroundResources.register(
        pack.atlas,
        level.background?.preset ?? 'night',
      );
      return level;
    }
    if (file.size > limits.maxBytes)
      throw new Error('Map exceeds the 2 MiB limit.');
    const text = await file.text();
    const level = parseLevel(text, options);
    const wire: unknown = JSON.parse(text);
    if (
      typeof wire === 'object' &&
      wire !== null &&
      'version' in wire &&
      wire.version === 4
    )
      throw new Error('JSON v4 requires its level ZIP with background.png.');
    if (!options?.draft) {
      const errors = playErrors(level);
      if (errors.length) throw new Error(errors.join(' '));
      return MapValidator.playable(level);
    }
    return level;
  }
  static async loadLevel(this: void) {
    const response = await fetch(
      `${import.meta.env.BASE_URL}maps/forest-ruins.json`,
    );
    if (!response.ok)
      throw new Error(`Could not load map (${response.status}).`);
    const text = await response.text();
    const level = parseLevel(text);
    const errors = playErrors(level);
    if (errors.length) throw new Error(errors.join(' '));
    return MapValidator.playable(level);
  }
}
export const readMapFile = MapFiles.readMapFile;
export const loadLevel = MapFiles.loadLevel;
