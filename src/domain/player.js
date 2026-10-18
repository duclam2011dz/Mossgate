export class Player {
  constructor(level) {
    Object.assign(this, {
      ...level.spawn,
      w: 10,
      h: 14,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: false,
      coyote: 0,
      buffer: 0,
      dash: 0,
      cooldown: 0,
      sneaking: false,
      dropKey: null,
      dropTimer: 0,
      springJump: false,
      travel: 0,
    });
  }
}
