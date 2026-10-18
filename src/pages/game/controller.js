import { GameOverlayController } from './overlay.js';
import { config as c } from '../../shared/config.js';
import {
  GameSimulation,
  emptyInput,
} from '../../simulation/game-simulation.js';
import { updateCamera } from '../../rendering/camera.js';
import { createViewport } from '../../rendering/viewport.js';
import { BrowserInput } from '../../infrastructure/input.js';
import { render } from '../../rendering/renderer.js';
import { createAnimation, updateAnimation } from '../../rendering/animation.js';
import { createEffects, updateEffects } from '../../rendering/effects.js';
import { BackgroundRenderer } from '../../rendering/background.js';
export class GameController {
  constructor(root, assets, level, onMenu, overlay) {
    const self = this;
    self.root = root;
    self.assets = assets;
    self.level = level;
    self.onMenu = onMenu;
    self.canvas = self.root.querySelector('canvas');
    self.ctx = self.canvas.getContext('2d');
    self.controller = new AbortController();
    self.signal = self.controller.signal;
    self.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    self.background = new BackgroundRenderer();
    self.run = new GameSimulation(self.level);
    self.anim = createAnimation();
    self.fx = createEffects();
    self.camera = { x: 0, y: 0 };
    self.viewport = undefined;
    self.last = performance.now();
    self.accumulator = 0;
    self.raf = 0;
    self.overlay =
      overlay ||
      new GameOverlayController(root, self.canvas, (label) =>
        self.action(label),
      );
    self.overlay.onAction = (label) => self.action(label);
    self.overlay.hide();
    self.input = new BrowserInput(self.canvas, self.pause);
    window.addEventListener('resize', self.resize, { signal: self.signal });
    window.addEventListener(
      'keydown',
      (e) => {
        if (
          e.code === 'Escape' &&
          !e.repeat &&
          self.run.state === 'playing' &&
          document.activeElement === self.canvas
        ) {
          e.preventDefault();
          self.pause();
        }
      },
      { signal: self.signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        cancelAnimationFrame(self.raf);
        self.last = performance.now();
        self.accumulator = 0;
        if (document.hidden) self.pause();
        else self.raf = requestAnimationFrame(self.tick);
      },
      { signal: self.signal },
    );
    self.resize();
    self.focus();
    if (document.hidden || !document.hasFocus()) self.pause();
    self.raf = requestAnimationFrame(self.tick);
    self.api = {
      dispose() {
        self.controller.abort();
        self.background.dispose();
        self.input.dispose();
        self.overlay.dispose();
        cancelAnimationFrame(self.raf);
      },
    };
    if (import.meta.env.MODE === 'test')
      Object.assign(self.api, {
        snapshot: () =>
          structuredClone({
            run: self.run,
            camera: self.camera,
            viewport: self.viewport,
            anim: self.anim,
            effects: {
              particles: self.fx.particles.length,
              ghosts: self.fx.ghosts.length,
              shake: self.fx.shake,
            },
          }),
        teleport(x, y) {
          Object.assign(self.run.player, { x, y, vx: 0, vy: 0, dash: 0 });
          self.sync(true);
        },
        advance(frames, controls = {}) {
          for (let i = 0; i < frames; i++)
            self.simulate({
              ...emptyInput(),
              ...controls,
              jumpPressed: i === 0 && !!controls.jumpPressed,
              dashPressed: i === 0 && !!controls.dashPressed,
            });
        },
        restart: self.restart,
      });
    Object.defineProperties(this, Object.getOwnPropertyDescriptors(self.api));
  }
  sync = (snap = false) => {
    const self = this;

    if (snap) self.background.reset();
    updateCamera(
      self.camera,
      self.run.player,
      self.level,
      c.step,
      snap,
      self.viewport,
    );
  };
  focus = () => {
    const self = this;

    self.canvas.focus({ preventScroll: true });
  };
  pause = () => {
    const self = this;

    if (self.run.state === 'playing') {
      self.run.state = 'paused';

      self.input.clear();
      self.accumulator = 0;
      self.overlay.show('paused', self.run);
    }
  };
  resume = () => {
    const self = this;

    if (self.run.state !== 'paused') return;
    self.overlay.hide();
    self.run.state = 'playing';

    self.input.clear();
    self.accumulator = 0;
    self.last = performance.now();
    self.focus();
  };
  restart = () => {
    const self = this;

    self.overlay.hide();
    self.input.clear();
    self.run = new GameSimulation(self.level);
    self.anim = createAnimation();
    self.fx = createEffects();

    self.accumulator = 0;
    self.last = performance.now();
    self.sync(true);
    self.focus();
  };
  action = (label) => {
    const self = this;

    if (label === 'Resume') self.resume();
    else if (label === 'Main Menu') self.onMenu();
    else self.restart();
  };
  resize = () => {
    const self = this;

    self.viewport = createViewport(innerWidth, innerHeight, devicePixelRatio);
    self.canvas.width = self.viewport.bufferWidth;
    self.canvas.height = self.viewport.bufferHeight;
    self.sync(true);
  };
  simulate = (controls) => {
    const self = this;

    const event = self.run.step(controls);
    if (event === 'respawn') {
      self.input.clear();
      self.anim = createAnimation();
      self.fx = createEffects();
      self.sync(true);
    } else {
      self.sync();
      updateAnimation(self.anim, self.run.player, c.step);
      updateEffects(
        self.fx,
        self.run.events,
        self.run.player,
        self.level,
        self.camera,
        self.viewport,
        self.anim,
        c.step,
        self.reduced.matches,
        self.run.broken,
      );
    }
    if (event === 'completed') {
      self.input.clear();
      self.overlay.show('completed', self.run);
    }
    return event;
  };
  tick = (now) => {
    const self = this;

    const elapsed = Math.min(5 * c.step, Math.max(0, (now - self.last) / 1000));
    self.last = now;
    if (self.run.state === 'playing') {
      self.accumulator += elapsed;
      let count = 0;
      while (self.accumulator >= c.step && count < 5) {
        const event = self.simulate(self.input.read());
        self.accumulator -= c.step;
        count++;
        if (event === 'completed') break;
      }
      if (count === 5) self.accumulator = 0;
    }
    render(
      self.ctx,
      self.assets,
      self.level,
      self.run,
      self.camera,
      self.viewport,
      self.anim,
      self.fx,
      self.reduced.matches,
      self.background,
      elapsed,
    );
    if (!document.hidden) self.raf = requestAnimationFrame(self.tick);
  };
}
export const mountGame = (...args) => new GameController(...args);
