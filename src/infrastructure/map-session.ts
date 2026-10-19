import { LevelPackageCodec } from './level-package.ts';
import { IndexedPackageStore } from './package-store.ts';
import type { PackageStore } from './package-store.ts';
import { MapValidator } from '../simulation/map-validator.ts';
import { BackgroundResources } from './background-resources.ts';
export class MapSession {
  static key = 'mossgate:play-map';
  private storage: Pick<Storage, 'setItem' | 'getItem'>;
  constructor(
    storage?: Pick<Storage, 'setItem' | 'getItem'>,
    private store: PackageStore = new IndexedPackageStore(),
  ) {
    try {
      this.storage = storage ?? globalThis.sessionStorage;
    } catch {
      throw new Error('Temporary browser storage is unavailable.');
    }
  }
  async save(data: Blob) {
    const token = crypto.randomUUID();
    try {
      const previous = this.storage.getItem(MapSession.key);
      await this.store.sweep(Date.now());
      await this.store.put({ token, created: Date.now(), data });
      this.storage.setItem(MapSession.key, token);
      if (previous) await this.store.delete(previous).catch(() => {});
      return token;
    } catch (error) {
      await this.store.delete(token).catch(() => {});
      throw new Error(
        'Could not transfer this map. Temporary browser storage is unavailable or full.',
        { cause: error },
      );
    }
  }
  async load(token: string) {
    let data: Blob;
    try {
      if (this.storage.getItem(MapSession.key) !== token)
        throw new Error('expired');
      const entry = await this.store.get(token);
      if (!entry || Date.now() - entry.created >= 86400000) {
        if (entry) await this.store.delete(token);
        throw new Error('expired');
      }
      data = entry.data;
    } catch (error) {
      throw new Error(
        'This temporary map has expired or storage is unavailable. Return to Menu and select it again.',
        { cause: error },
      );
    }
    const pack = await LevelPackageCodec.decode(data),
      level = MapValidator.playable(pack.level);
    level.background = await BackgroundResources.register(
      pack.atlas,
      level.background?.preset ?? 'night',
    );
    return level;
  }
  static async cleanup() {
    await new IndexedPackageStore().sweep(Date.now()).catch(() => {});
  }
}
