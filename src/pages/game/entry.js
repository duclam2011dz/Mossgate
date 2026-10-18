import { GameOverlayController } from './overlay.js';
import { assetManager } from '../../infrastructure/assets.js';
import { loadLevel } from '../../infrastructure/map-files.js';
import { MapSession } from '../../infrastructure/map-session.js';
import { PageNavigation } from '../../infrastructure/navigation.js';
import { GameController } from './controller.js';
const root = document.querySelector('#app'),
  canvas = root.querySelector('canvas');
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
    window.__game = controller;
    window.__app = { route: 'play' };
  }
} catch (error) {
  overlay.show('error', { message: error.message });
  window.addEventListener('pagehide', () => overlay.dispose(), { once: true });
}
