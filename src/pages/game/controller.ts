import type { Assets } from '../../infrastructure/assets.ts';
import type { PlayableMap, Input, Point } from '../../domain/contracts.ts';
import type { AnimationController } from '../../rendering/animation.ts';
import type { EffectsSystem } from '../../rendering/effects.ts';
import type { OverlayAction } from './overlay.ts';
import { Dom } from '../../infrastructure/dom.ts';
import { GameOverlayController } from './overlay.ts';
import { config as c } from '../../shared/config.ts';
import { GameSimulation } from '../../simulation/game-simulation.ts';
import { updateCamera } from '../../rendering/camera.ts';
import { createViewport } from '../../rendering/viewport.ts';
import { BrowserInput } from '../../infrastructure/input.ts';
import { render } from '../../rendering/renderer.ts';
import { createAnimation, updateAnimation } from '../../rendering/animation.ts';
import { createEffects, updateEffects } from '../../rendering/effects.ts';
import { BackgroundRenderer } from '../../rendering/background.ts';
export class GameController {
  root: HTMLElement;
  assets: Assets;
  level: PlayableMap;
  onMenu: () => void;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  controller: AbortController;
  signal: AbortSignal;
  reduced: MediaQueryList;
  background: BackgroundRenderer;
  run: GameSimulation;
  anim: AnimationController;
  fx: EffectsSystem;
  camera: Point;
  viewport = createViewport(1, 1);
  last: number;
  accumulator: number;
  raf: number;
  overlay: GameOverlayController;
  input: BrowserInput;
  constructor(
    root: HTMLElement,
    assets: Assets,
    level: PlayableMap,
    onMenu: () => void,
    overlay?: GameOverlayController,
  ) {
    this.root = root;
    this.assets = assets;
    this.level = level;
    this.onMenu = onMenu;
    this.canvas = Dom.require(this.root, 'canvas', HTMLCanvasElement);
    this.ctx = Dom.context(this.canvas);
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.background = new BackgroundRenderer();
    this.run = new GameSimulation(this.level);
    this.anim = createAnimation();
    this.fx = createEffects();
    this.camera = { x: 0, y: 0 };
    this.last = performance.now();
    this.accumulator = 0;
    this.raf = 0;
    this.overlay =
      overlay ||
      new GameOverlayController(root, this.canvas, (label) =>
        this.action(label),
      );
    this.overlay.onAction = (label) => this.action(label);
    this.overlay.hide();
    this.input = new BrowserInput(this.canvas, this.pause);
    window.addEventListener('resize', this.resize, { signal: this.signal });
    window.addEventListener(
      'keydown',
      (e) => {
        if (
          e.code === 'Escape' &&
          !e.repeat &&
          this.run.state === 'playing' &&
          document.activeElement === this.canvas
        ) {
          e.preventDefault();
          this.pause();
        }
      },
      { signal: this.signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        cancelAnimationFrame(this.raf);
        this.last = performance.now();
        this.accumulator = 0;
        if (document.hidden) this.pause();
        else this.raf = requestAnimationFrame(this.tick);
      },
      { signal: this.signal },
    );
    this.resize();
    this.focus();
    if (document.hidden || !document.hasFocus()) this.pause();
    this.raf = requestAnimationFrame(this.tick);
  }
  dispose() {
    this.controller.abort();
    this.background.dispose();
    this.input.dispose();
    this.overlay.dispose();
    cancelAnimationFrame(this.raf);
  }
  sync = (snap = false) => {
    if (snap) this.background.reset();
    updateCamera(
      this.camera,
      this.run.player,
      this.level,
      c.step,
      snap,
      this.viewport,
    );
  };
  focus = () => {
    this.canvas.focus({ preventScroll: true });
  };
  pause = () => {
    if (this.run.state === 'playing') {
      this.run.state = 'paused';

      this.input.clear();
      this.accumulator = 0;
      this.overlay.show('paused', this.run);
    }
  };
  resume = () => {
    if (this.run.state !== 'paused') return;
    this.overlay.hide();
    this.run.state = 'playing';

    this.input.clear();
    this.accumulator = 0;
    this.last = performance.now();
    this.focus();
  };
  restart = () => {
    this.overlay.hide();
    this.input.clear();
    this.run = new GameSimulation(this.level);
    this.anim = createAnimation();
    this.fx = createEffects();

    this.accumulator = 0;
    this.last = performance.now();
    this.sync(true);
    this.focus();
  };
  action = (label: OverlayAction) => {
    if (label === 'Resume') this.resume();
    else if (label === 'Main Menu') this.onMenu();
    else this.restart();
  };
  resize = () => {
    this.viewport = createViewport(innerWidth, innerHeight, devicePixelRatio);
    this.canvas.width = this.viewport.bufferWidth;
    this.canvas.height = this.viewport.bufferHeight;
    this.sync(true);
  };
  simulate = (controls: Input) => {
    const event = this.run.step(controls);
    if (event === 'respawn') {
      this.input.clear();
      this.anim = createAnimation();
      this.fx = createEffects();
      this.sync(true);
    } else {
      this.sync();
      updateAnimation(this.anim, this.run.player, c.step);
      updateEffects(
        this.fx,
        this.run.events,
        this.run.player,
        this.level,
        this.camera,
        this.viewport,
        this.anim,
        c.step,
        this.reduced.matches,
        this.run.broken,
      );
    }
    if (event === 'completed') {
      this.input.clear();
      this.overlay.show('completed', this.run);
    }
    return event;
  };
  tick = (now: number) => {
    const elapsed = Math.min(5 * c.step, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.run.state === 'playing') {
      this.accumulator += elapsed;
      let count = 0;
      while (this.accumulator >= c.step && count < 5) {
        const event = this.simulate(this.input.read());
        this.accumulator -= c.step;
        count++;
        if (event === 'completed') break;
      }
      if (count === 5) this.accumulator = 0;
    }
    render(
      this.ctx,
      this.assets,
      this.level,
      this.run,
      this.camera,
      this.viewport,
      this.anim,
      this.fx,
      this.reduced.matches,
      this.background,
      elapsed,
    );
    if (!document.hidden) this.raf = requestAnimationFrame(this.tick);
  };
}
export const mountGame = (
  ...args: ConstructorParameters<typeof GameController>
) => new GameController(...args);
