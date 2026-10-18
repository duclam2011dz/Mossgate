import { assetManager } from '../../infrastructure/assets.js';
import { EditorController } from '../../editor/controller.js';
import { PageNavigation } from '../../infrastructure/navigation.js';
const root = document.querySelector('#app');
try {
  const controller = new EditorController(
    root,
    await assetManager.load('editor'),
    () => PageNavigation.go('menu'),
  );
  window.addEventListener('pagehide', () => controller.dispose(), {
    once: true,
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  if (import.meta.env.MODE === 'test')
    window.__app = { route: 'editor', editor: () => controller.snapshot() };
} catch (error) {
  PageNavigation.error(root, error);
}
