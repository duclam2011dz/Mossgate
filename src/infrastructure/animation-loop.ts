export class AnimationLoop {
  draw: (dt: number, now: number) => void;
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
  active: boolean;
  disposed: boolean;
  visible: boolean;
  frame: number | null;
  last: number | null;
  constructor(
    draw: (dt: number, now: number) => void,
    {
      request = (callback: FrameRequestCallback) =>
        requestAnimationFrame(callback),
      cancel = (id: number) => cancelAnimationFrame(id),
    } = {},
  ) {
    this.draw = draw;
    this.request = request;
    this.cancel = cancel;
    this.active = false;
    this.disposed = false;
    this.visible = true;
    this.frame = null;
    this.last = null;
  }
  start(visible = true) {
    if (this.active || this.disposed) return;
    this.active = true;
    this.visible = visible;
    this.schedule();
  }
  schedule() {
    if (this.active && this.visible && this.frame === null)
      this.frame = this.request(this.tick);
  }
  tick = (now: number) => {
    this.frame = null;
    if (!this.active || !this.visible) return;
    const dt =
      this.last === null
        ? 0
        : Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.draw(dt, now);
    this.schedule();
  };
  setVisible(visible: boolean) {
    this.visible = visible;
    this.last = null;
    if (this.frame !== null) {
      this.cancel(this.frame);
      this.frame = null;
    }
    this.schedule();
  }
  dispose() {
    this.disposed = true;
    this.active = false;
    this.setVisible(false);
  }
}
