import { parseLevel, limits } from '../domain/map-codec.js';
import { playErrors } from '../simulation/map-validator.js';
export class MapFiles {
  static async readMapFile(file, options) {
    if (file.size > limits.maxBytes)
      throw new Error('Map exceeds the 2 MiB limit.');
    const level = parseLevel(await file.text(), options);
    if (!options?.draft) {
      const errors = playErrors(level);
      if (errors.length) throw new Error(errors.join(' '));
    }
    return level;
  }
  static async loadLevel() {
    const response = await fetch(
      `${import.meta.env.BASE_URL}maps/forest-ruins.json`,
    );
    if (!response.ok)
      throw new Error(`Could not load map (${response.status}).`);
    const level = parseLevel(await response.text());
    const errors = playErrors(level);
    if (errors.length) throw new Error(errors.join(' '));
    return level;
  }
}
export const readMapFile = MapFiles.readMapFile;
export const loadLevel = MapFiles.loadLevel;
