import { describe, it, expect } from 'vitest';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { MapCodec } from '../../src/domain/map-codec.ts';
import { EditorModel, blankLevel } from '../../src/editor/model.ts';
import {
  LevelPackageCodec,
  packageLimits,
} from '../../src/infrastructure/level-package.ts';
import { BackgroundResources } from '../../src/infrastructure/background-resources.ts';
async function archive(entries: [string, Blob][]) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [name, data] of entries)
    await writer.add(name, new BlobReader(data), { level: 0 });
  return await writer.close();
}
describe('background contracts', () => {
  it('upgrades old drafts to Night and exports compact v4', () => {
    const old = {
      version: 2,
      size: [16, 12],
      spawn: null,
      portal: null,
      deathY: 256,
      rects: [],
    };
    const level = MapCodec.decodeLevel(old);
    expect(level.background).toEqual({
      preset: 'night',
      image: './background.png',
    });
    expect(MapCodec.encodeLevel(level).version).toBe(4);
  });
  it.each(['storm', 'DAY', null, 4])('rejects unknown scene %j', (preset) => {
    const wire = MapCodec.encodeLevel(blankLevel());
    expect(() =>
      MapCodec.decodeLevel({
        ...wire,
        background: { preset, image: './background.png' },
      }),
    ).toThrow(/background/);
  });
  it.each([
    '../background.png',
    'https://host/bg.png',
    '/bg.png',
    './sub/bg.png',
    './image.svg',
  ])('rejects external or traversing image path %s', (image) => {
    expect(() =>
      MapCodec.decodeLevel({
        ...MapCodec.encodeLevel(blankLevel()),
        background: { preset: 'rain', image },
      }),
    ).toThrow(/background/);
  });
  it('restores custom resource identity across background undo/redo and dirty revisions', () => {
    const model = new EditorModel();
    model.begin();
    model.level.background = { preset: 'rain', image: './custom-example.png' };
    model.commit();
    model.saved = model.revision;
    model.begin();
    model.level.background = { preset: 'day', image: './background.png' };
    model.commit();
    expect(model.dirty).toBe(true);
    model.undo();
    expect(model.level.background?.image).toBe('./custom-example.png');
    expect(model.dirty).toBe(false);
    model.redo();
    expect(model.level.background?.preset).toBe('day');
  });
});
describe('bounded ZIP and atlas validation', () => {
  it('rejects raw JSON and oversized archives', async () => {
    await expect(LevelPackageCodec.decode(new Blob(['{}']))).rejects.toThrow(
      /ZIP/,
    );
    await expect(
      LevelPackageCodec.decode(
        new Blob([new Uint8Array(packageLimits.archive + 1)]),
      ),
    ).rejects.toThrow(/24 MiB/);
  });
  it('rejects wrong entries, traversal and mixed folders', async () => {
    for (const entries of [
      [['map/level.json', new Blob(['{}'])]],
      [
        ['../level.json', new Blob(['{}'])],
        ['map/background.png', new Blob(['png'])],
      ],
      [
        ['a/level.json', new Blob(['{}'])],
        ['b/background.png', new Blob(['png'])],
      ],
      [
        ['a/level.json', new Blob(['{}'])],
        ['a/background.png', new Blob(['png'])],
        ['a/extra.txt', new Blob(['x'])],
      ],
    ] satisfies [string, Blob][][]) {
      await expect(
        LevelPackageCodec.decode(await archive(entries)),
      ).rejects.toThrow();
    }
  });
  it('checks schema and PNG signature, not only filenames', async () => {
    const data = JSON.stringify(MapCodec.encodeLevel(blankLevel()));
    await expect(
      LevelPackageCodec.decode(
        await archive([
          ['map/level.json', new Blob([data])],
          ['map/background.png', new Blob(['not png'])],
        ]),
      ),
    ).rejects.toThrow(/PNG/);
    await expect(
      LevelPackageCodec.decode(
        await archive([
          ['map/level.json', new Blob(['{broken'])],
          ['map/background.png', new Blob(['png'])],
        ]),
      ),
    ).rejects.toThrow(/JSON/);
  });
  it('rejects false PNG dimensions before allocating an image', async () => {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    new DataView(bytes.buffer).setUint32(16, 16384);
    new DataView(bytes.buffer).setUint32(20, 16384);
    await expect(
      BackgroundResources.validate(new Blob([bytes])),
    ).rejects.toThrow(/2560/);
  });
});

it('rejects encrypted ZIP entries before requesting a password', async () => {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  await writer.add('map/level.json', new BlobReader(new Blob(['{}'])), {
    password: 'example',
    level: 0,
  });
  await writer.add('map/background.png', new BlobReader(new Blob(['png'])), {
    level: 0,
  });
  await expect(LevelPackageCodec.decode(await writer.close())).rejects.toThrow(
    /entries/,
  );
});
it('rejects duplicate central-directory paths', async () => {
  const data = new Uint8Array(
    await (
      await archive([
        ['map/level.json', new Blob(['{}'])],
        ['map/other.json', new Blob(['{}'])],
      ])
    ).arrayBuffer(),
  );
  const needle = new TextEncoder().encode('map/other.json'),
    replacement = new TextEncoder().encode('map/level.json');
  for (let i = 0; i <= data.length - needle.length; i++)
    if (needle.every((byte, j) => data[i + j] === byte))
      data.set(replacement, i);
  await expect(LevelPackageCodec.decode(new Blob([data]))).rejects.toThrow(
    /entries/,
  );
});
