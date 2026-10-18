export class GlassDialog {
  static confirm(
    message,
    { signal, title = 'Unsaved changes', accept = 'Discard changes' } = {},
  ) {
    if (signal?.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
      const previous = document.activeElement,
        dialog = document.createElement('dialog');
      dialog.className = 'glass-dialog confirmation';
      const heading = document.createElement('h2'),
        body = document.createElement('p'),
        actions = document.createElement('div'),
        cancel = document.createElement('button'),
        ok = document.createElement('button');
      const id = `confirmation-${crypto.randomUUID()}`;
      heading.id = id;
      heading.textContent = title;
      dialog.setAttribute('aria-labelledby', id);
      body.textContent = message;
      actions.className = 'dialog-actions';
      cancel.textContent = 'Cancel';
      ok.textContent = accept;
      ok.className = 'primary';
      actions.append(cancel, ok);
      dialog.append(heading, body, actions);
      document.body.append(dialog);
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', abort);
        dialog.close();
        dialog.remove();
        if (previous?.isConnected) previous.focus({ preventScroll: true });
        resolve(value);
      };
      const abort = () => finish(false);
      signal?.addEventListener('abort', abort, { once: true });
      cancel.addEventListener('click', () => finish(false));
      ok.addEventListener('click', () => finish(true));
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        finish(false);
      });
      dialog.showModal();
      cancel.focus();
    });
  }
}
