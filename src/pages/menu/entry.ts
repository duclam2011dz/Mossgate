import { Dom } from '../../infrastructure/dom.ts';
import { MenuController } from './controller.ts';
import { PageNavigation } from '../../infrastructure/navigation.ts';
if (!PageNavigation.legacy()) {
  const controller = new MenuController(
    Dom.require(document, '#app', HTMLElement),
  );
  void controller.start();
  window.addEventListener('pagehide', () => controller.dispose(), {
    once: true,
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  if (import.meta.env.MODE === 'test') window.__app = { route: 'menu' };
}
