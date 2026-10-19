import type { Assets } from '../../infrastructure/assets.ts';
import { Dom } from '../../infrastructure/dom.ts';
import { Guards } from '../../shared/guards.ts';
import { AnimationLoop } from '../../infrastructure/animation-loop.ts';
import { GlassMotion } from '../../infrastructure/glass-motion.ts';
import { uiConfig } from '../../shared/config.ts';
import { assetManager } from '../../infrastructure/assets.ts';
import { readMapFile } from '../../infrastructure/map-files.ts';
import { MapSession } from '../../infrastructure/map-session.ts';
import { PageNavigation } from '../../infrastructure/navigation.ts';
import { BackgroundRenderer } from '../../rendering/background.ts';
import { Viewport } from '../../rendering/viewport.ts';
export class MenuController {
  root: HTMLElement;
  abort: AbortController;
  background: BackgroundRenderer;
  camera: { x: number; y: number };
  loop: AnimationLoop;
  motion: MediaQueryList;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  glassMotion: GlassMotion;
  assets: Assets = {};
  view = Viewport.createViewport(1, 1);
  constructor(root: HTMLElement) {
    this.root = root;
    this.abort = new AbortController();
    this.background = new BackgroundRenderer();
    this.camera = { x: 0, y: 0 };
    this.loop = new AnimationLoop((dt) => this.tick(dt));
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.canvas = Dom.require(document, '#menu-background', HTMLCanvasElement);
    this.context = Dom.context(this.canvas);
    const signal = this.abort.signal,
      dialog = Dom.require(root, 'dialog', HTMLDialogElement),
      input = Dom.require(root, 'input', HTMLInputElement),
      play = Dom.require(root, '#play', HTMLButtonElement);
    const close = () => {
      dialog.close();
      play.focus();
    };
    play.addEventListener(
      'click',
      () => {
        dialog.showModal();
        Dom.require(root, '#sample-map', HTMLElement).focus();
      },
      { signal },
    );
    Dom.require(root, '.dialog-close', HTMLElement).addEventListener(
      'click',
      close,
      { signal },
    );
    dialog.addEventListener(
      'cancel',
      (e) => {
        e.preventDefault();
        close();
      },
      { signal },
    );
    Dom.require(root, '#edit', HTMLElement).addEventListener(
      'click',
      () => PageNavigation.go('editor'),
      { signal },
    );
    Dom.require(root, '#sample-map', HTMLElement).addEventListener(
      'click',
      () => PageNavigation.go('game', { map: 'forest-ruins' }),
      { signal },
    );
    Dom.require(root, '#open-map', HTMLElement).addEventListener(
      'click',
      () => {
        close();
        input.click();
      },
      { signal },
    );
    input.addEventListener(
      'change',
      async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        try {
          const level = await readMapFile(file);
          if (signal.aborted) return;
          const token = new MapSession().save(level);
          PageNavigation.go('game', { session: token });
        } catch (error) {
          Dom.require(root, '#menu-message', HTMLElement).textContent =
            Guards.error(error);
        }
      },
      { signal },
    );
    window.addEventListener('resize', () => this.resize(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => this.loop.setVisible(!document.hidden),
      { signal },
    );
    this.glassMotion = new GlassMotion(root, signal);
    this.resize();
    play.focus();
    root.setAttribute('aria-busy', 'false');
  }
  async start() {
    try {
      this.assets = await assetManager.load('background');
      if (!this.abort.signal.aborted) this.loop.start(!document.hidden);
    } catch (error) {
      if (!this.abort.signal.aborted)
        Dom.require(this.root, '#menu-message', HTMLElement).textContent =
          Guards.error(error);
    }
  }
  resize() {
    this.view = Viewport.createViewport(
      innerWidth,
      innerHeight,
      devicePixelRatio,
    );
    this.canvas.width = this.view.bufferWidth;
    this.canvas.height = this.view.bufferHeight;
    this.background.reset();
  }
  tick(dt: number) {
    this.camera.x += uiConfig.menuScrollSpeed * dt;
    this.background.draw(
      this.context,
      this.assets,
      this.camera,
      this.view,
      dt,
      true,
      false,
      false,
    );
  }
  dispose() {
    this.abort.abort();
    this.loop.dispose();
    this.background.dispose();
  }
}
