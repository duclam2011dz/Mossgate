import type { BackgroundSpec } from '../domain/contracts.ts';
import type { BackgroundRenderer } from '../rendering/background.ts';
import { BackgroundResources } from './background-resources.ts';
/** Last request wins; an unsuccessful load leaves the previous scene intact. */
export class SceneController {
  private revision = 0;
  private current = '';
  private disposed = false;
  constructor(private renderer: BackgroundRenderer) {}
  async apply(spec?: BackgroundSpec, animate = false) {
    const key = BackgroundResources.key(spec) + ':' + (spec?.preset ?? 'night');
    if (key === this.current) return;
    const revision = ++this.revision,
      image = await BackgroundResources.load(spec);
    if (this.disposed || revision !== this.revision) return;
    this.renderer.setScene(
      image,
      spec?.preset ?? 'night',
      animate && !matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    document.documentElement.dataset.scene = spec?.preset ?? 'night';
    this.current = key;
  }
  dispose() {
    this.disposed = true;
    this.revision++;
  }
}
