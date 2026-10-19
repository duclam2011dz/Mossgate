export const clips = Object.freeze({
  idle: { frames: 24, loop: true },
  walk: { frames: 24, loop: true },
  'sneak-idle': { frames: 24, loop: true },
  'sneak-walk': { frames: 24, loop: true },
  dash: { frames: 6, loop: true },
  jump: { frames: 6, loop: false },
  fall: { frames: 12, loop: true },
});

export const effectNames = [
  'dust',
  'mud',
  'ice',
  'spark',
  'debris',
  'burst',
  'ring',
] as const;
