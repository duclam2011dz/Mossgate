export class GlassMotion {
  constructor(root, signal) {
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.surfaces = [...root.querySelectorAll('[data-glass-tilt]')];
    for (const surface of this.surfaces) {
      const reset = () => {
        surface.style.setProperty('--tilt-x', '0deg');
        surface.style.setProperty('--tilt-y', '0deg');
      };
      surface.addEventListener(
        'pointermove',
        (e) => {
          if (
            this.motion.matches ||
            surface.querySelector('input:focus,textarea:focus,select:focus')
          ) {
            reset();
            return;
          }
          const rect = surface.getBoundingClientRect(),
            x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
            y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          surface.style.setProperty('--tilt-x', `${(0.5 - y) * 8}deg`);
          surface.style.setProperty('--tilt-y', `${(x - 0.5) * 8}deg`);
          surface.style.setProperty('--light-x', `${x * 100}%`);
          surface.style.setProperty('--light-y', `${y * 100}%`);
        },
        { signal },
      );
      surface.addEventListener('pointerleave', reset, { signal });
      surface.addEventListener('focusin', reset, { signal });
      this.motion.addEventListener('change', reset, { signal });
    }
  }
}
