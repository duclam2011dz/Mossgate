import { AnimationLoop } from './animation-loop.ts';
import { GlassWaterModel } from '../domain/glass-water.ts';
interface WetSurface {
  host: HTMLElement;
  layer: HTMLElement;
  drops: HTMLElement[];
  trails: HTMLElement[];
  model: GlassWaterModel;
}
/** One document-wide clock. Refraction belongs beneath controls, never on their text. */
export class GlassWeather {
  private surfaces: WetSurface[] = [];
  private scan = 1;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  private loop = new AnimationLoop((dt) => this.tick(dt));
  private svg: SVGSVGElement;
  constructor(signal: AbortSignal) {
    const ns = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(ns, 'svg');
    this.svg.setAttribute('class', 'weather-filters');
    this.svg.setAttribute('aria-hidden', 'true');
    this.svg.innerHTML =
      '<defs><filter id="rain-refraction" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.085" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    document.body.append(this.svg);
    document.addEventListener(
      'visibilitychange',
      () => this.loop.setVisible(!document.hidden),
      { signal },
    );
    signal.addEventListener('abort', () => this.dispose(), { once: true });
    this.loop.start(!document.hidden);
  }
  private clear() {
    for (const surface of this.surfaces) surface.layer.remove();
    this.surfaces = [];
  }
  private visible(host: HTMLElement) {
    const rect = host.getBoundingClientRect();
    return (
      host.isConnected &&
      host.getClientRects().length > 0 &&
      getComputedStyle(host).opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth
    );
  }
  private discover() {
    this.surfaces = this.surfaces.filter((surface) => {
      if (surface.host.isConnected) return true;
      surface.layer.remove();
      return false;
    });
    let budget =
      180 - this.surfaces.reduce((n, s) => n + s.model.drops.length, 0);
    for (const host of document.querySelectorAll<HTMLElement>(
      '.glass-surface,dialog[open],.editor-bar,.palette,.editor-status,.inspector:not([hidden])',
    )) {
      if (
        !this.visible(host) ||
        this.surfaces.some((s) => s.host === host) ||
        budget <= 0
      )
        continue;
      const rect = host.getBoundingClientRect();
      const count = Math.min(
        budget,
        32,
        Math.max(6, Math.floor((rect.width * rect.height) / 6500)),
      );
      budget -= count;
      const layer = document.createElement('span');
      layer.className = 'glass-water';
      layer.setAttribute('aria-hidden', 'true');
      host.prepend(layer);
      const nodes = (className: string) =>
        Array.from({ length: count }, () => {
          const node = document.createElement('i');
          node.className = className;
          layer.append(node);
          return node;
        });
      this.surfaces.push({
        host,
        layer,
        drops: nodes('water-bead'),
        trails: nodes('water-trail'),
        model: new GlassWaterModel(count),
      });
    }
  }
  private tick(dt: number) {
    if (document.documentElement.dataset.scene !== 'rain') {
      if (this.surfaces.length) this.clear();
      return;
    }
    this.scan += dt;
    if (this.scan > 0.7) {
      this.scan = 0;
      this.discover();
    }
    for (const surface of this.surfaces) {
      if (!this.visible(surface.host)) continue;
      // Inspector innerHTML may detach the decoration without destroying its host.
      if (surface.layer.parentElement !== surface.host)
        surface.host.prepend(surface.layer);
      const rect = surface.host.getBoundingClientRect();
      surface.model.update(dt, rect.width, rect.height, this.motion.matches);
      surface.model.drops.forEach((drop, i) => {
        const node = surface.drops[i];
        if (!node) return;
        node.style.width = `${drop.radius * 2}px`;
        node.style.height = `${drop.radius * 2 + (this.motion.matches ? 0 : drop.speed * 0.12)}px`;
        node.style.opacity = String(drop.wait > 0 ? 0 : drop.opacity);
        node.style.transform = `translate3d(${drop.x * rect.width}px,${drop.y * rect.height}px,0)`;
      });
      surface.trails.forEach((node, i) => {
        const trail = surface.model.trails[i];
        node.style.opacity = String(trail?.opacity ?? 0);
        if (!trail) return;
        node.style.width = `${Math.max(0.2, trail.width * trail.opacity)}px`;
        node.style.height = `${trail.length}px`;
        node.style.transform = `translate3d(${trail.x * rect.width}px,${trail.y * rect.height}px,0) skewX(${trail.bend}deg)`;
      });
    }
  }
  dispose() {
    this.loop.dispose();
    this.clear();
    this.svg.remove();
  }
}
