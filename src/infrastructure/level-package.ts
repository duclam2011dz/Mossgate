import { BlobReader, BlobWriter, ZipReader, ZipWriter } from '@zip.js/zip.js';
import type { DraftMap } from '../domain/contracts.ts';
import { MapCodec, limits } from '../domain/map-codec.ts';
import { BackgroundResources } from './background-resources.ts';
export const packageLimits = Object.freeze({
  archive: 24 * 1024 * 1024,
  png: 20 * 1024 * 1024,
});
export interface LevelPackage {
  level: DraftMap;
  atlas: Blob;
}
/** Strict two-file archive codec; never resolves URLs from untrusted JSON. */
export class LevelPackageCodec {
  static async encode(level: DraftMap, atlas: Blob) {
    await BackgroundResources.validate(atlas);
    const json = JSON.stringify(MapCodec.encodeLevel(level));
    if (new TextEncoder().encode(json).length > limits.maxBytes)
      throw new Error('Map exceeds the 2 MiB limit.');
    const writer = new ZipWriter(new BlobWriter('application/zip'), {
      useWebWorkers: false,
    });
    await writer.add(
      'mossgate-map/level.json',
      new BlobReader(new Blob([json])),
      { level: 6 },
    );
    await writer.add('mossgate-map/background.png', new BlobReader(atlas), {
      level: 0,
    });
    const result = await writer.close();
    if (result.size > packageLimits.archive)
      throw new Error('Level ZIP exceeds 24 MiB.');
    return result;
  }
  static async decode(blob: Blob): Promise<LevelPackage> {
    if (!blob.size || blob.size > packageLimits.archive)
      throw new Error('Level ZIP exceeds 24 MiB or is empty.');
    const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (
      signature[0] !== 80 ||
      signature[1] !== 75 ||
      signature[2] !== 3 ||
      signature[3] !== 4
    )
      throw new Error('Could not open map. Select a valid level ZIP.');
    const reader = new ZipReader(new BlobReader(blob), {
      useWebWorkers: false,
    });
    try {
      const entries = [];
      let total = 0;
      const names = new Set<string>();
      for await (const entry of reader.getEntriesGenerator()) {
        if (
          entries.length >= 3 ||
          names.has(entry.filename) ||
          entry.encrypted ||
          !/^[-a-zA-Z0-9_]+\/(?:level\.json|background\.png)?$/.test(
            entry.filename,
          )
        )
          throw new Error('Invalid level ZIP entries.');
        names.add(entry.filename);
        entries.push(entry);
        total += entry.uncompressedSize;
        if (total > packageLimits.archive)
          throw new Error('Unpacked level exceeds 24 MiB.');
      }
      const files = entries.filter((e) => !e.directory);
      const json = files.find((e) => e.filename.endsWith('/level.json')),
        png = files.find((e) => e.filename.endsWith('/background.png'));
      if (
        files.length !== 2 ||
        !json ||
        !png ||
        json.filename.split('/')[0] !== png.filename.split('/')[0] ||
        json.uncompressedSize > limits.maxBytes ||
        png.uncompressedSize > packageLimits.png ||
        entries.some(
          (entry) =>
            entry.directory &&
            entry.filename !== json.filename.split('/')[0] + '/',
        )
      )
        throw new Error(
          'ZIP must contain one folder with level.json and background.png.',
        );
      const extract = async (entry: typeof json, cap: number) => {
        let size = 0;
        // Bound actual output even when archive size metadata is forged.
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        const bounded = new WritableStream<Uint8Array>({
          write(chunk) {
            size += chunk.byteLength;
            if (size > cap) throw new Error('Unpacked entry exceeds limit.');
            chunks.push(new Uint8Array(chunk));
          },
        });
        await entry.getData(bounded, { checkSignature: true });
        return new Blob(chunks);
      };
      const text = await (await extract(json, limits.maxBytes)).text();
      const level = MapCodec.parseLevel(text, { draft: true });
      const raw: unknown = JSON.parse(text);
      if (
        typeof raw !== 'object' ||
        raw === null ||
        !('version' in raw) ||
        raw.version !== 4 ||
        level.background?.image !== './background.png'
      )
        throw new Error('Packaged maps require JSON v4 and ./background.png.');
      const atlas = await extract(png, packageLimits.png);
      await BackgroundResources.validate(atlas);
      return { level, atlas };
    } finally {
      await reader.close();
    }
  }
}
