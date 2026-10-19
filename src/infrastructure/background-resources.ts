import type { BackgroundPreset, BackgroundSpec } from '../domain/contracts.ts';
/** Immutable PNG resources. Maps/history hold keys, never image bytes. Owned by the document. */
export class BackgroundResources {
  private static epoch = 0;
  private static records = new Map<
    string,
    { blob: Blob; image: HTMLImageElement }
  >();
  private static pending = new Map<string, Promise<HTMLImageElement>>();
  static key(spec?: BackgroundSpec) {
    return spec?.image.startsWith('./custom-')
      ? spec.image
      : `preset:${spec?.preset ?? 'night'}`;
  }
  static async validate(blob: Blob): Promise<HTMLImageElement> {
    if (!blob.size || blob.size > 20 * 1024 * 1024)
      throw new Error('PNG exceeds the 20 MiB limit.');
    const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((v, i) => bytes[i] === v) || bytes.length !== 24)
      throw new Error('Invalid PNG atlas.');
    const header = new DataView(bytes.buffer);
    if (header.getUint32(16) !== 2560 || header.getUint32(20) !== 1920)
      throw new Error(
        'Atlas must be a 2560 x 1920 PNG (four 1280 x 960 layers).',
      );
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth !== 2560 || image.naturalHeight !== 1920)
        throw new Error('Invalid atlas dimensions.');
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  static async register(
    blob: Blob,
    preset: BackgroundPreset,
  ): Promise<BackgroundSpec> {
    const epoch = this.epoch;
    const image = await this.validate(blob),
      imageKey = `./custom-${crypto.randomUUID()}.png`;
    if (epoch !== this.epoch)
      throw new Error('Background loading was cancelled.');
    this.records.set(imageKey, { blob, image });
    return { preset, image: imageKey };
  }
  static async load(spec?: BackgroundSpec): Promise<HTMLImageElement> {
    const key = this.key(spec),
      existing = this.records.get(key);
    if (existing) return existing.image;
    if (key.startsWith('./custom-'))
      throw new Error(
        'Background atlas is unavailable. Import the level again.',
      );
    let pending = this.pending.get(key);
    if (!pending) {
      const epoch = this.epoch;
      pending = (async () => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}assets/background-${spec?.preset ?? 'night'}-atlas.png`,
        );
        if (!response.ok) throw new Error('Could not load background atlas.');
        const blob = await response.blob(),
          image = await this.validate(blob);
        if (epoch !== this.epoch)
          throw new Error('Background loading was cancelled.');
        this.records.set(key, { blob, image });
        return image;
      })();
      this.pending.set(key, pending);
    }
    try {
      return await pending;
    } finally {
      this.pending.delete(key);
    }
  }
  static async blob(spec?: BackgroundSpec) {
    await this.load(spec);
    const record = this.records.get(this.key(spec));
    if (!record) throw new Error('Missing atlas.');
    return record.blob;
  }
  static retain(keys: Set<string>) {
    for (const key of this.records.keys())
      if (key.startsWith('./custom-') && !keys.has(key))
        this.records.delete(key);
  }
  static clear() {
    this.epoch++;
    this.records.clear();
    this.pending.clear();
  }
}
