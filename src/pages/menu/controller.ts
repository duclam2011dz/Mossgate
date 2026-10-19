import { BackgroundDialog } from '../../infrastructure/background-dialog.ts';
import { SceneController } from '../../infrastructure/scene-controller.ts';
import { BackgroundResources } from '../../infrastructure/background-resources.ts';
import type { BackgroundSpec } from '../../domain/contracts.ts';
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
  scene: SceneController;
  private importing = false;
  selected: BackgroundSpec = { preset: 'night', image: './background.png' };
  view = Viewport.createViewport(1, 1);
  constructor(root: HTMLElement) {
    this.root = root;
    this.abort = new AbortController();
    this.background = new BackgroundRenderer();
    this.scene = new SceneController(this.background);
    void MapSession.cleanup();
    try {
      const preset = sessionStorage.getItem('mossgate:menu-scene');
      if (preset === 'day' || preset === 'rain') this.selected.preset = preset;
    } catch {
      /* Menu remains usable without storage. */
    }
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
        if (!file || this.importing) return;
        this.importing = true;
        root.setAttribute('aria-busy', 'true');
        const buttons = [...root.querySelectorAll('button')];
        buttons.forEach((button) => {
          button.disabled = true;
        });
        Dom.require(root, '#menu-message', HTMLElement).textContent =
          'Opening level ZIP...';
        try {
          await readMapFile(file);
          if (signal.aborted) return;
          const token = await new MapSession().save(file);
          if (!signal.aborted) PageNavigation.go('game', { session: token });
        } catch (error) {
          if (!signal.aborted)
            Dom.require(root, '#menu-message', HTMLElement).textContent =
              Guards.error(error);
        } finally {
          this.importing = false;
          if (!signal.aborted) {
            root.setAttribute('aria-busy', 'false');
            buttons.forEach((button) => {
              button.disabled = false;
            });
          }
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
    Dom.require(root, '#background-choice', HTMLButtonElement).addEventListener(
      'click',
      async () => {
        const selected = await BackgroundDialog.open(
          this.selected,
          signal,
          false,
        );
        if (!selected || signal.aborted) return;
        try {
          await this.scene.apply(selected, true);
          this.selected = selected;
          try {
            sessionStorage.setItem('mossgate:menu-scene', selected.preset);
          } catch {
            /* Optional preference only. */
          }
        } catch (error) {
          Dom.require(root, '#menu-message', HTMLElement).textContent =
            Guards.error(error);
        }
      },
      { signal },
    );
    this.glassMotion = new GlassMotion(root, signal);
    this.resize();
    play.focus();
    root.setAttribute('aria-busy', 'false');
  }
  async start() {
    try {
      await this.scene.apply(this.selected);
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
      this.motion.matches,
      false,
      false,
    );
  }
  dispose() {
    this.abort.abort();
    this.loop.dispose();
    this.scene.dispose();
    this.background.dispose();
    BackgroundResources.clear();
  }
}
