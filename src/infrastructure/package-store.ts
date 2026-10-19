import { Guards } from '../shared/guards.ts';
export interface StoredPackage {
  token: string;
  created: number;
  data: Blob;
}
export interface PackageStore {
  put(entry: StoredPackage): Promise<void>;
  get(token: string): Promise<StoredPackage | undefined>;
  delete(token: string): Promise<void>;
  sweep(now: number): Promise<void>;
}
/** Short-lived Blob transport, not an editor draft store or map library. */
export class IndexedPackageStore implements PackageStore {
  private async transaction<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('mossgate-transfer', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('packages', { keyPath: 'token' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Temporary storage failed.'));
      request.onblocked = () =>
        reject(new Error('Temporary storage is blocked.'));
    });
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('packages', mode);
      const request = work(transaction.objectStore('packages'));
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      transaction.onerror = transaction.onabort = () => {
        db.close();
        reject(transaction.error ?? new Error('Temporary storage failed.'));
      };
    });
  }
  async put(entry: StoredPackage) {
    await this.transaction('readwrite', (s) => s.put(entry));
  }
  async get(token: string) {
    const value: unknown = await this.transaction('readonly', (s) =>
      s.get(token),
    );
    if (value === undefined) return undefined;
    if (
      !Guards.record(value) ||
      value.token !== token ||
      !Guards.number(value.created) ||
      !(value.data instanceof Blob)
    )
      throw new Error('Corrupted temporary package.');
    return { token, created: value.created, data: value.data };
  }
  async delete(token: string) {
    await this.transaction('readwrite', (s) => s.delete(token));
  }
  async sweep(now: number) {
    const keys = await this.transaction('readonly', (s) => s.getAllKeys());
    for (const key of keys)
      if (typeof key === 'string') {
        const value = await this.get(key);
        if (value && now - value.created >= 86400000) await this.delete(key);
      }
  }
}
