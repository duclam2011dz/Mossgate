import { it, expect } from 'vitest';
import { AnimationLoop } from '../../src/infrastructure/animation-loop.ts';
import { GameOverlayController } from '../../src/pages/game/overlay.ts';
import { BackgroundRenderer } from '../../src/rendering/background.ts';
import { uiConfig } from '../../src/shared/config.ts';
it('starts only once, suspends hidden time and cannot restart after disposal', () => {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>(),
    samples: number[] = [];
  const loop = new AnimationLoop((dt) => samples.push(dt), {
    request: (cb) => {
      pending.set(++id, cb);
      return id;
    },
    cancel: (i) => pending.delete(i),
  });
  const frame = (now: number) => {
    const entry = pending.entries().next().value;
    if (!entry) throw new Error('Expected scheduled animation frame');
    const [key, callback] = entry;
    pending.delete(key);
    callback(now);
  };
  loop.setVisible(true);
  expect(pending.size).toBe(0);
  loop.start();
  loop.start();
  expect(pending.size).toBe(1);
  frame(0);
  frame(1000 / 60);
  expect(samples[1]).toBeCloseTo(1 / 60);
  expect(pending.size).toBe(1);
  loop.setVisible(false);
  expect(pending.size).toBe(0);
  loop.setVisible(true);
  frame(500000);
  expect(samples.at(-1)).toBe(0);
  loop.dispose();
  loop.start();
  loop.setVisible(true);
  expect(pending.size).toBe(0);
});
it('advances the configured Menu camera at 24 world units per second', () => {
  expect(uiConfig.menuScrollSpeed).toBe(24);
  for (const fps of [24, 60, 144]) {
    let x = 0;
    for (let i = 0; i < fps * 5; i++) x += uiConfig.menuScrollSpeed / fps;
    expect(x).toBeCloseTo(120);
    expect(BackgroundRenderer.offset(x, 0.28)).toBeCloseTo(-33.6);
  }
});
it('maps the full-page editor backdrop to workspace coordinates after zoom/sidebar resize', () => {
  for (const zoom of [0.25, 1, 4]) {
    const bounds = { left: 180, top: 96 },
      result = BackgroundRenderer.editorPageView(
        { x: 24, y: 12 },
        zoom,
        1280,
        800,
        bounds,
      ),
      scale = (32 * zoom) / 16;
    expect(result.camera.x + bounds.left / scale).toBe(384);
    expect(result.camera.y + bounds.top / scale).toBe(192);
    expect(result.view.width * scale).toBe(1280);
  }
});
it('uses distinct HTML overlay content for loading, pause, completion and errors', () => {
  expect(GameOverlayController.content('loading').actions).toEqual([]);
  expect(GameOverlayController.content('paused').actions).toEqual([
    'Resume',
    'Restart',
    'Main Menu',
  ]);
  expect(
    GameOverlayController.content('completed', { elapsed: 125.9, falls: 3 }),
  ).toMatchObject({
    message: '02:05 · 3 Deaths',
    actions: ['Play Again', 'Main Menu'],
  });
  expect(
    GameOverlayController.content('error', { message: 'Invalid map' }),
  ).toMatchObject({ message: 'Invalid map', actions: ['Main Menu'] });
});
