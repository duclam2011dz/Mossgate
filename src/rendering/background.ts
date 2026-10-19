import type { BackgroundPreset } from '../domain/contracts.ts';
import { RainRenderer } from './weather.ts';
import type { Point } from '../domain/contracts.ts';
import type { Assets } from '../infrastructure/assets.ts';
import { Dom } from '../infrastructure/dom.ts';
export const backgroundLayers = Object.freeze([
  ['sky', 0.02, 0.015],
  ['distant', 0.08, 0.03],
  ['midground', 0.16, 0.06],
  ['near', 0.28, 0.09],
] as const);
export class BackgroundRenderer {
  buffer: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  previous: Point | null = null;
  private atlas: HTMLImageElement | null = null;
  private outgoing: HTMLImageElement | null = null;
  private fade = 1;
  private preset: BackgroundPreset = 'night';
  private rain = new RainRenderer();
  setScene(atlas: HTMLImageElement, preset: BackgroundPreset, animate = false) {
    if (this.atlas === atlas && this.preset === preset) return;
    this.outgoing = animate ? this.atlas : null;
    this.fade = animate ? 0 : 1;
    this.atlas = atlas;
    this.preset = preset;
    this.reset();
  }
  vx = 0;
  vy = 0;
  constructor() {
    this.buffer = document.createElement('canvas');
    this.context = Dom.context(this.buffer);
    this.reset();
  }
  static offset(this: void, position: number, factor: number, period = 320) {
    return -((((position * factor) % period) + period) % period);
  }
  static editorView(
    this: void,
    camera: Point,
    zoom: number,
    width: number,
    height: number,
  ) {
    const scale = 32 * zoom;
    return {
      camera: { x: camera.x * 16, y: camera.y * 16 },
      view: { width: (width / scale) * 16, height: (height / scale) * 16 },
    };
  }
  static editorPageView(
    this: void,
    camera: Point,
    zoom: number,
    width: number,
    height: number,
    bounds: { left: number; top: number },
  ) {
    const scale = (32 * zoom) / 16;
    return {
      camera: {
        x: camera.x * 16 - bounds.left / scale,
        y: camera.y * 16 - bounds.top / scale,
      },
      view: { width: width / scale, height: height / scale },
    };
  }
  reset() {
    this.previous = null;
    this.vx = 0;
    this.vy = 0;
  }
  draw(
    target: CanvasRenderingContext2D,
    assets: Assets,
    camera: Point,
    view: { width: number; height: number },
    dt = 0,
    reduced = true,
    playing = false,
    dashing = false,
  ) {
    const w = Math.max(1, Math.ceil(target.canvas.width / 2)),
      h = Math.max(1, Math.ceil(target.canvas.height / 2)),
      ctx = this.context;
    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
      this.reset();
    }
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    this.fade = Math.min(1, this.fade + dt / 0.6);
    if (reduced) this.fade = 1;
    const scenes =
      this.outgoing && this.fade < 1
        ? ([
            [this.outgoing, 1],
            [this.atlas, this.fade],
          ] as const)
        : ([[this.atlas, 1]] as const);
    if (this.fade === 1) this.outgoing = null;
    for (const [atlas, alpha] of scenes) {
      ctx.globalAlpha = alpha;
      for (const [index, [name, px, py]] of backgroundLayers.entries()) {
        const image = atlas ?? assets[`background-${name}`];
        if (!image) continue;
        const sceneHeight = Math.max(240, view.height + 60),
          period = (sceneHeight * 4) / 3;
        const x = BackgroundRenderer.offset(camera.x, px, period),
          y = -Math.max(0, Math.min(60, camera.y * py));
        for (let dx = x - period; dx < view.width + period; dx += period) {
          ctx.drawImage(
            image,
            atlas ? (index % 2) * 1280 : 0,
            atlas ? Math.floor(index / 2) * 960 : 0,
            atlas ? 1280 : image.naturalWidth,
            atlas ? 960 : image.naturalHeight,
            (dx / view.width) * w,
            (y / view.height) * h,
            (period / view.width) * w,
            (sceneHeight / view.height) * h,
          );
        }
      }
    }
    ctx.globalAlpha = 1;
    if (this.previous && dt > 0 && playing) {
      const blend = 1 - Math.exp(-12 * dt);
      this.vx += ((camera.x - this.previous.x) / dt - this.vx) * blend;
      this.vy += ((camera.y - this.previous.y) / dt - this.vy) * blend;
    } else this.vx = this.vy = 0;
    this.previous = { ...camera };
    const speed = Math.hypot(this.vx, this.vy),
      ratio = target.canvas.width / Math.max(1, target.canvas.clientWidth),
      length =
        !reduced && playing
          ? Math.min(6, speed * 0.012) * (dashing ? 1 : 0.6) * ratio
          : 0;
    const ox = speed ? (this.vx / speed) * length : 0,
      oy = speed ? (this.vy / speed) * length : 0,
      samples = length > 0.15 ? 3 : 1;
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.imageSmoothingEnabled = true;
    for (let i = 0; i < samples; i++) {
      target.globalAlpha = samples === 1 || i === 0 ? 1 : 0.22;
      target.drawImage(
        this.buffer,
        (ox * i) / (samples - 1 || 1),
        (oy * i) / (samples - 1 || 1),
        target.canvas.width,
        target.canvas.height,
      );
    }
    target.restore();
    if (this.preset === 'rain') this.rain.draw(target, dt, reduced);
  }
  dispose() {
    this.buffer.width = 1;
    this.buffer.height = 1;
    this.reset();
  }
}
export const createBackground = () => new BackgroundRenderer();
