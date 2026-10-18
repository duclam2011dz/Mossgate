import { MapCodec } from '../domain/map-codec.js';
import { MapValidator } from '../simulation/map-validator.js';
export class MapSession {
  static key = 'mossgate:play-map';
  constructor(storage) {
    try {
      this.storage = storage ?? globalThis.sessionStorage;
    } catch {
      throw new Error(
        'Temporary browser storage is unavailable. Return to Menu and select the map again.',
      );
    }
  }
  save(level) {
    const token = crypto.randomUUID();
    try {
      this.storage.setItem(
        MapSession.key,
        JSON.stringify({ token, map: MapCodec.encodeLevel(level) }),
      );
    } catch {
      throw new Error(
        'Could not transfer this map. Temporary browser storage is unavailable or full.',
      );
    }
    return token;
  }
  load(token) {
    let entry;
    try {
      entry = JSON.parse(this.storage.getItem(MapSession.key));
    } catch {
      throw new Error(
        'Could not read the temporary map. Return to Menu and select it again.',
      );
    }
    if (!entry || entry.token !== token)
      throw new Error(
        'This temporary map has expired. Return to Menu and select it again.',
      );
    const level = MapCodec.parseLevel(
      typeof entry.map === 'string' ? entry.map : JSON.stringify(entry.map),
    );
    const errors = MapValidator.playErrors(level);
    if (errors.length) throw new Error(errors.join(' '));
    return level;
  }
}
