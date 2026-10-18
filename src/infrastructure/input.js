import { emptyInput } from '../shared/input-state.js';
export class BrowserInput {
  constructor(canvas, onBlur) {
    const self = this;
    self.canvas = canvas;
    self.onBlur = onBlur;
    self.controller = new AbortController();
    self.signal = self.controller.signal;
    self.held = new Set();
    self.jump = false;
    self.dash = false;
    self.keys = [
      'KeyA',
      'KeyD',
      'KeyW',
      'KeyS',
      'Tab',
      'ShiftLeft',
      'ShiftRight',
    ];
    window.addEventListener(
      'keydown',
      (e) => {
        if (
          document.activeElement !== self.canvas ||
          !self.keys.includes(e.code)
        )
          return;
        e.preventDefault();
        if (e.repeat) return;
        if (e.code === 'KeyW') self.jump = true;
        if (e.code === 'Tab') self.dash = true;
        self.held.add(e.code);
      },
      { signal: self.signal },
    );
    window.addEventListener('keyup', (e) => self.held.delete(e.code), {
      signal: self.signal,
    });
    self.blur = () => {
      self.clear();
      self.onBlur();
    };
    window.addEventListener('blur', self.blur, { signal: self.signal });
    self.canvas.addEventListener('blur', self.blur, { signal: self.signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) self.blur();
      },
      { signal: self.signal },
    );
    Object.defineProperties(
      this,
      Object.getOwnPropertyDescriptors({
        clear: self.clear,
        dispose: () => self.controller.abort(),
        read() {
          const value = {
            ...emptyInput(),
            axis: Number(self.held.has('KeyD')) - Number(self.held.has('KeyA')),
            jumpPressed: self.jump,
            jumpHeld: self.held.has('KeyW'),
            dashPressed: self.dash,
            sneak: self.held.has('ShiftLeft') || self.held.has('ShiftRight'),
            down: self.held.has('KeyS'),
          };
          self.jump = false;
          self.dash = false;
          return value;
        },
      }),
    );
  }
  clear = () => {
    const self = this;

    self.held.clear();
    self.jump = false;
    self.dash = false;
  };
}
export const createInput = (...args) => new BrowserInput(...args);
