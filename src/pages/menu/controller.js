import { AnimationLoop } from '../../infrastructure/animation-loop.js';
import { GlassMotion } from '../../infrastructure/glass-motion.js';
import { uiConfig } from '../../shared/config.js';
import { assetManager } from '../../infrastructure/assets.js';
import { readMapFile } from '../../infrastructure/map-files.js';
import { MapSession } from '../../infrastructure/map-session.js';
import { PageNavigation } from '../../infrastructure/navigation.js';
import { BackgroundRenderer } from '../../rendering/background.js';
import { Viewport } from '../../rendering/viewport.js';
export class MenuController {
  constructor(root) {
    this.root = root;
    this.abort = new AbortController();
    this.background = new BackgroundRenderer();
    this.camera = { x: 0, y: 0 };
    this.loop = new AnimationLoop((dt) => this.tick(dt));
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.canvas = document.querySelector('#menu-background');
    this.context = this.canvas.getContext('2d');
    const signal = this.abort.signal,
      dialog = root.querySelector('dialog'),
      input = root.querySelector('input'),
      play = root.querySelector('#play');
    const close = () => {
      dialog.close();
      play.focus();
    };
    play.addEventListener(
      'click',
      () => {
        dialog.showModal();
        root.querySelector('#sample-map').focus();
      },
      { signal },
    );
    root
      .querySelector('.dialog-close')
      .addEventListener('click', close, { signal });
    dialog.addEventListener(
      'cancel',
      (e) => {
        e.preventDefault();
        close();
      },
      { signal },
    );
    root
      .querySelector('#edit')
      .addEventListener('click', () => PageNavigation.go('editor'), { signal });
    root
      .querySelector('#sample-map')
      .addEventListener(
        'click',
        () => PageNavigation.go('game', { map: 'forest-ruins' }),
        { signal },
      );
    root.querySelector('#open-map').addEventListener(
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
        const file = input.files[0];
        input.value = '';
        if (!file) return;
        try {
          const level = await readMapFile(file);
          if (signal.aborted) return;
          const token = new MapSession().save(level);
          PageNavigation.go('game', { session: token });
        } catch (error) {
          root.querySelector('#menu-message').textContent = error.message;
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
        this.root.querySelector('#menu-message').textContent = error.message;
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
  tick(dt) {
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
