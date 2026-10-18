import { clips } from '../shared/asset-definitions.js';
export { clips };
export const createAnimation = () => new AnimationController();

export class AnimationController {
  constructor() {
    this.state = 'idle';
    this.time = 0;
    this.frame = 0;
  }
  update(player, dt) {
    return AnimationController.updateAnimation(this, player, dt);
  }
  static animationState(p) {
    if (p.dash > 0) return 'dash';
    if (p.sneaking) return Math.abs(p.vx) > 3 ? 'sneak-walk' : 'sneak-idle';
    if (!p.grounded) return p.vy < 0 ? 'jump' : 'fall';
    return Math.abs(p.vx) > 3 ? 'walk' : 'idle';
  }
  static updateAnimation(anim, p, dt) {
    const state = animationState(p);
    if (state !== anim.state) {
      anim.state = state;
      anim.time = 0;
    } else anim.time += dt;
    const clip = clips[state],
      frame = Math.floor((anim.time + 1e-9) * 24);
    anim.frame = clip.loop
      ? frame % clip.frames
      : Math.min(clip.frames - 1, frame);
    return anim;
  }
}
export const animationState = AnimationController.animationState;
export const updateAnimation = AnimationController.updateAnimation;
