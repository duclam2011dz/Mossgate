import { Dom } from '../../infrastructure/dom.ts';
import { Guards } from '../../shared/guards.ts';
import { GameOverlayController } from './overlay.ts';
import { assetManager } from '../../infrastructure/assets.ts';
import { loadLevel } from '../../infrastructure/map-files.ts';
import { MapSession } from '../../infrastructure/map-session.ts';
import { PageNavigation } from '../../infrastructure/navigation.ts';
import { emptyInput } from '../../shared/input-state.ts';
import { GameController } from './controller.ts';
const root = Dom.require(document, '#app', HTMLElement),
  canvas = Dom.require(root, 'canvas', HTMLCanvasElement);
const overlay = new GameOverlayController(root, canvas, () =>
  PageNavigation.go('menu'),
);
overlay.show('loading');
try {
  const params = new URLSearchParams(location.search),
    token = params.get('session');
  if (params.has('map') && params.get('map') !== 'forest-ruins')
    throw new Error('Unknown built-in map.');
  if (params.has('session') && !token)
    throw new Error(
      'This temporary map has expired. Return to Menu and select it again.',
    );
  if (token && params.has('map')) throw new Error('Choose one map source.');
  const level = token ? new MapSession().load(token) : await loadLevel();
  const controller = new GameController(
    root,
    await assetManager.load('game'),
    level,
    () => PageNavigation.go('menu'),
    overlay,
  );
  window.addEventListener('pagehide', () => controller.dispose(), {
    once: true,
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  if (import.meta.env.MODE === 'test') {
    window.__game = {
      input: { read: () => controller.input.read() },
      snapshot: () =>
        structuredClone({
          run: controller.run,
          camera: controller.camera,
          viewport: controller.viewport,
          anim: controller.anim,
          effects: {
            particles: controller.fx.particles.length,
            ghosts: controller.fx.ghosts.length,
            shake: controller.fx.shake,
          },
        }),
      teleport: (x, y) => {
        Object.assign(controller.run.player, { x, y, vx: 0, vy: 0, dash: 0 });
        controller.sync(true);
      },
      advance: (frames, controls = {}) => {
        for (let i = 0; i < frames; i++)
          controller.simulate({
            ...emptyInput(),
            ...controls,
            jumpPressed: i === 0 && !!controls.jumpPressed,
            dashPressed: i === 0 && !!controls.dashPressed,
          });
      },
      restart: controller.restart,
    };
    window.__app = { route: 'play' };
  }
} catch (error) {
  overlay.show('error', { message: Guards.error(error) });
  window.addEventListener('pagehide', () => overlay.dispose(), { once: true });
}
