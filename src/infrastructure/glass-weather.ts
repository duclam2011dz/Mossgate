import { AnimationLoop } from './animation-loop.ts';
interface Bead {
  node: HTMLElement;
  x: number;
  y: number;
  radius: number;
  speed: number;
}
interface WetSurface {
  host: HTMLElement;
  layer: HTMLElement;
  drops: Bead[];
  width: number;
  height: number;
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
  private discover() {
    this.clear();
    let budget = 180;
    for (const host of document.querySelectorAll<HTMLElement>(
      '.glass-surface,dialog[open],.editor-bar,.palette,.editor-status,.inspector:not([hidden])',
    )) {
      const rect = host.getBoundingClientRect();
      if (
        !host.getClientRects().length ||
        getComputedStyle(host).opacity === '0' ||
        rect.width < 1 ||
        rect.height < 1 ||
        rect.bottom < 0 ||
        rect.top > innerHeight ||
        budget <= 0
      )
        continue;
      const layer = document.createElement('span');
      layer.className = 'glass-water';
      layer.setAttribute('aria-hidden', 'true');
      host.prepend(layer);
      const drops: Bead[] = [];
      const count = Math.min(
        budget,
        32,
        Math.max(6, Math.floor((rect.width * rect.height) / 6500)),
      );
      budget -= count;
      for (let i = 0; i < count; i++) {
        const node = document.createElement('i'),
          radius = 1.5 + Math.random() * 3.5;
        node.className = 'water-bead';
        layer.append(node);
        drops.push({
          node,
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          radius,
          speed: radius > 4 ? 8 + Math.random() * 12 : 0,
        });
      }
      this.surfaces.push({
        host,
        layer,
        drops,
        width: rect.width,
        height: rect.height,
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
      const visible = [
        ...document.querySelectorAll<HTMLElement>(
          '.glass-surface,dialog[open],.editor-bar,.palette,.editor-status,.inspector:not([hidden])',
        ),
      ].filter(
        (el) =>
          el.getClientRects().length && getComputedStyle(el).opacity !== '0',
      );
      if (
        visible.length !== this.surfaces.length ||
        this.surfaces.some(
          (s) =>
            !s.host.isConnected ||
            !visible.includes(s.host) ||
            Math.abs(s.host.getBoundingClientRect().width - s.width) > 2 ||
            Math.abs(s.host.getBoundingClientRect().height - s.height) > 2,
        )
      )
        this.discover();
    }
    for (const surface of this.surfaces) {
      for (const drop of surface.drops) {
        if (!this.motion.matches) {
          if (drop.speed === 0) {
            drop.radius = Math.min(5, drop.radius + dt * 0.08);
            if (drop.radius > 4) drop.speed = 8;
          }
          drop.y += drop.speed * dt;
          drop.x += Math.sin(drop.y * 0.04) * dt * 1.5;
          if (drop.y > surface.height + 20) {
            drop.y = -12;
            drop.x = Math.random() * surface.width;
            drop.radius = 2 + Math.random() * 3;
            drop.speed = drop.radius > 4 ? 10 : 0;
          }
          if (drop.speed > 0)
            for (const other of surface.drops)
              if (
                other !== drop &&
                Math.abs(other.x - drop.x) < drop.radius + other.radius &&
                Math.abs(other.y - drop.y) < drop.radius + other.radius
              ) {
                drop.radius = Math.min(
                  7,
                  Math.sqrt(drop.radius ** 2 + other.radius ** 2),
                );
                drop.speed = Math.min(35, drop.speed + 4);
                other.y = Math.random() * surface.height;
                other.x = Math.random() * surface.width;
                other.radius = 1.5 + Math.random() * 2;
                other.speed = 0;
              }
        }
        drop.node.style.width = `${drop.radius * 2}px`;
        drop.node.style.height = `${drop.radius * 2 + (this.motion.matches ? 0 : drop.speed * 0.8)}px`;
        drop.node.style.transform = `translate3d(${drop.x}px,${drop.y}px,0)`;
      }
    }
  }
  dispose() {
    this.loop.dispose();
    this.clear();
    this.svg.remove();
  }
}
