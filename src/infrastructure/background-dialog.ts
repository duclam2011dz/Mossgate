import type { BackgroundPreset, BackgroundSpec } from '../domain/contracts.ts';
import { BackgroundResources } from './background-resources.ts';
import { Dom } from './dom.ts';
import { Guards } from '../shared/guards.ts';
export class BackgroundDialog {
  static open(
    current: BackgroundSpec | undefined,
    signal: AbortSignal,
    custom: boolean,
  ): Promise<BackgroundSpec | null> {
    return new Promise((resolve) => {
      const previous = document.activeElement,
        dialog = document.createElement('dialog');
      dialog.className = 'background-dialog';
      dialog.setAttribute('aria-labelledby', 'background-title');
      dialog.innerHTML =
        '<h2 id="background-title">Background</h2><label>Scene<select aria-label="Background scene"><option value="night">Night</option><option value="day">Day</option><option value="rain">Rain</option></select></label><canvas width="480" height="180" aria-label="Background preview"></canvas><p class="atlas-label"></p><p role="status"></p><input type="file" accept=".png,image/png" hidden><div class="dialog-actions">' +
        (custom ? '<button data-import>Import atlas</button>' : '') +
        '<button data-cancel>Cancel</button><button data-apply class="primary">Apply</button></div>';
      document.body.append(dialog);
      const select = Dom.require(dialog, 'select', HTMLSelectElement),
        canvas = Dom.require(dialog, 'canvas', HTMLCanvasElement),
        status = Dom.require(dialog, '[role="status"]', HTMLElement),
        apply = Dom.require(dialog, '[data-apply]', HTMLButtonElement),
        input = Dom.require(dialog, 'input', HTMLInputElement);
      let draft: BackgroundSpec = current
          ? { ...current }
          : { preset: 'night', image: './background.png' },
        version = 0,
        closed = false;
      select.value = draft.preset;
      const preview = async () => {
        const revision = ++version;
        apply.disabled = true;
        status.textContent = 'Loading background...';
        try {
          const image = await BackgroundResources.load(draft);
          if (closed || revision !== version) return;
          const ctx = Dom.context(canvas);
          ctx.clearRect(0, 0, 480, 180);
          for (let i = 0; i < 4; i++)
            ctx.drawImage(
              image,
              (i % 2) * 1280,
              Math.floor(i / 2) * 960,
              1280,
              960,
              0,
              0,
              480,
              360,
            );
          Dom.require(dialog, '.atlas-label', HTMLElement).textContent =
            draft.image.startsWith('./custom-')
              ? 'Custom atlas - 2560 x 1920'
              : 'Built-in atlas - four layers';
          status.textContent = '';
          apply.disabled = false;
        } catch (error) {
          if (!closed && revision === version)
            status.textContent = Guards.error(error);
        }
      };
      const finish = (value: BackgroundSpec | null) => {
        if (closed) return;
        closed = true;
        version++;
        signal.removeEventListener('abort', abort);
        dialog.close();
        dialog.remove();
        if (previous instanceof HTMLElement && previous.isConnected)
          previous.focus();
        resolve(value);
      };
      const abort = () => finish(null);
      signal.addEventListener('abort', abort, { once: true });
      select.addEventListener('change', () => {
        const preset: BackgroundPreset =
          select.value === 'day'
            ? 'day'
            : select.value === 'rain'
              ? 'rain'
              : 'night';
        draft = { preset, image: './background.png' };
        void preview();
      });
      dialog
        .querySelector('[data-import]')
        ?.addEventListener('click', () => input.click());
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        const revision = ++version;
        apply.disabled = true;
        try {
          const spec = await BackgroundResources.register(file, draft.preset);
          if (closed || revision !== version) return;
          draft = spec;
          await preview();
        } catch (error) {
          if (!closed && revision === version) {
            status.textContent = Guards.error(error);
            apply.disabled = false;
          }
        }
      });
      dialog
        .querySelector('[data-cancel]')
        ?.addEventListener('click', () => finish(null));
      apply.addEventListener('click', () => finish(draft));
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        finish(null);
      });
      if (signal.aborted) {
        finish(null);
        return;
      }
      dialog.showModal();
      select.focus();
      void preview();
    });
  }
}
