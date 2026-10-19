import { emptyInput } from '../shared/input-state.ts';
export class BrowserInput {
  canvas: HTMLCanvasElement;
  onBlur: () => void;
  controller: AbortController;
  signal: AbortSignal;
  held: Set<string>;
  jump: boolean;
  dash: boolean;
  keys: string[];
  blur: () => void;
  constructor(canvas: HTMLCanvasElement, onBlur: () => void) {
    this.canvas = canvas;
    this.onBlur = onBlur;
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    this.held = new Set<string>();
    this.jump = false;
    this.dash = false;
    this.keys = [
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
          document.activeElement !== this.canvas ||
          !this.keys.includes(e.code)
        )
          return;
        e.preventDefault();
        if (e.repeat) return;
        if (e.code === 'KeyW') this.jump = true;
        if (e.code === 'Tab') this.dash = true;
        this.held.add(e.code);
      },
      { signal: this.signal },
    );
    window.addEventListener('keyup', (e) => this.held.delete(e.code), {
      signal: this.signal,
    });
    this.blur = () => {
      this.clear();
      this.onBlur();
    };
    window.addEventListener('blur', this.blur, { signal: this.signal });
    this.canvas.addEventListener('blur', this.blur, { signal: this.signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.blur();
      },
      { signal: this.signal },
    );
  }
  dispose() {
    this.controller.abort();
  }
  read() {
    const value = {
      ...emptyInput(),
      axis: Number(this.held.has('KeyD')) - Number(this.held.has('KeyA')),
      jumpPressed: this.jump,
      jumpHeld: this.held.has('KeyW'),
      dashPressed: this.dash,
      sneak: this.held.has('ShiftLeft') || this.held.has('ShiftRight'),
      down: this.held.has('KeyS'),
    };
    this.jump = false;
    this.dash = false;
    return value;
  }
  clear = () => {
    this.held.clear();
    this.jump = false;
    this.dash = false;
  };
}
export const createInput = (
  ...args: ConstructorParameters<typeof BrowserInput>
) => new BrowserInput(...args);
