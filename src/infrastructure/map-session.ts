import type { DraftMap } from '../domain/contracts.ts';
import { Guards } from '../shared/guards.ts';
import { MapCodec } from '../domain/map-codec.ts';
import { MapValidator } from '../simulation/map-validator.ts';
export class MapSession {
  static key = 'mossgate:play-map';
  storage: Pick<Storage, 'setItem' | 'getItem'>;
  constructor(storage?: Pick<Storage, 'setItem' | 'getItem'>) {
    try {
      this.storage = storage ?? globalThis.sessionStorage;
    } catch {
      throw new Error(
        'Temporary browser storage is unavailable. Return to Menu and select the map again.',
      );
    }
  }
  save(level: DraftMap) {
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
  load(token: string) {
    let entry: unknown;
    try {
      entry = JSON.parse(this.storage.getItem(MapSession.key) ?? 'null');
    } catch {
      throw new Error(
        'Could not read the temporary map. Return to Menu and select it again.',
      );
    }
    if (!Guards.record(entry) || entry.token !== token)
      throw new Error(
        'This temporary map has expired. Return to Menu and select it again.',
      );
    const level = MapCodec.parseLevel(
      typeof entry.map === 'string' ? entry.map : JSON.stringify(entry.map),
    );
    const errors = MapValidator.playErrors(level);
    if (errors.length) throw new Error(errors.join(' '));
    return MapValidator.playable(level);
  }
}
