import { Dom } from '../../infrastructure/dom.ts';
import { assetManager } from '../../infrastructure/assets.ts';
import { EditorController } from '../../editor/controller.ts';
import { PageNavigation } from '../../infrastructure/navigation.ts';
const root = Dom.require(document, '#app', HTMLElement);
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
    window.__app = {
      route: 'editor',
      editor: () =>
        structuredClone({
          level: controller.model.level,
          camera: controller.camera,
          zoom: controller.zoom,
          dirty: controller.model.dirty,
          history: controller.model.history.length,
          future: controller.model.future.length,
          tool: controller.tool,
          selection: controller.selection,
        }),
    };
} catch (error) {
  PageNavigation.error(root, error);
}
