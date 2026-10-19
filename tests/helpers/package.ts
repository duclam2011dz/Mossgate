import { BlobReader, BlobWriter, ZipReader, ZipWriter } from '@zip.js/zip.js';
import { readFileSync } from 'node:fs';
import { MapCodec } from '../../src/domain/map-codec.ts';
/** Browser tests use real ZIP bytes, without a production backdoor for JSON uploads. */
export async function levelZip(text: string, atlas?: Uint8Array<ArrayBuffer>) {
  const level = MapCodec.parseLevel(text, { draft: true }),
    writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  await writer.add(
    'mossgate-map/level.json',
    new BlobReader(new Blob([JSON.stringify(MapCodec.encodeLevel(level))])),
    { level: 0 },
  );
  await writer.add(
    'mossgate-map/background.png',
    new BlobReader(
      new Blob([
        atlas ??
          new Uint8Array(
            readFileSync(
              `public/assets/background-${level.background?.preset ?? 'night'}-atlas.png`,
            ),
          ),
      ]),
    ),
    { level: 0 },
  );
  return Buffer.from(await (await writer.close()).arrayBuffer());
}
export async function exportedJson(path: string) {
  const reader = new ZipReader(
    new BlobReader(new Blob([new Uint8Array(readFileSync(path))])),
    { useWebWorkers: false },
  );
  try {
    const entry = (await reader.getEntries()).find((e) =>
      e.filename.endsWith('/level.json'),
    );
    if (!entry || entry.directory) throw new Error('Missing exported JSON');
    return await (await entry.getData(new BlobWriter())).text();
  } finally {
    await reader.close();
  }
}
