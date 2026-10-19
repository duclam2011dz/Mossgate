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
    if (file.size > limits.maxBytes)
      throw new Error('Map exceeds the 2 MiB limit.');
    const level = parseLevel(await file.text(), options);
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
