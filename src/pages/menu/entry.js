import { MenuController } from './controller.js';
import { PageNavigation } from '../../infrastructure/navigation.js';
if (!PageNavigation.legacy()) {
  const controller = new MenuController(document.querySelector('#app'));
  controller.start();
  window.addEventListener('pagehide', () => controller.dispose(), {
    once: true,
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  if (import.meta.env.MODE === 'test') window.__app = { route: 'menu' };
}
