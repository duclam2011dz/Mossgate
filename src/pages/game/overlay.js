export class GameOverlayController {
  static content(state, run = {}) {
    const minutes = String(Math.floor((run.elapsed || 0) / 60)).padStart(
        2,
        '0',
      ),
      seconds = String(Math.floor((run.elapsed || 0) % 60)).padStart(2, '0');
    if (state === 'paused')
      return {
        title: 'Paused',
        message: 'Take a breath. The forest can wait.',
        actions: ['Resume', 'Restart', 'Main Menu'],
      };
    if (state === 'completed')
      return {
        title: 'Gate reached!',
        message: `${minutes}:${seconds} · ${run.falls || 0} Deaths`,
        actions: ['Play Again', 'Main Menu'],
      };
    if (state === 'error')
      return {
        title: 'Could not enter the forest',
        message: run.message || 'Please try again.',
        actions: ['Main Menu'],
      };
    return {
      title: 'Preparing the forest',
      message: 'Gathering the paths and light…',
      actions: [],
    };
  }
  constructor(root, canvas, onAction) {
    this.root = root;
    this.canvas = canvas;
    this.onAction = onAction;
    this.state = 'playing';
    this.abort = new AbortController();
    this.host = document.createElement('section');
    this.host.className = 'game-overlay';
    this.host.setAttribute('role', 'dialog');
    this.host.setAttribute('aria-modal', 'true');
    this.host.setAttribute('aria-labelledby', 'game-overlay-title');
    this.host.hidden = true;
    this.host.inert = true;
    this.panel = document.createElement('div');
    this.panel.className = 'game-panel glass-surface';
    this.panel.tabIndex = -1;
    this.heading = document.createElement('h1');
    this.heading.id = 'game-overlay-title';
    this.message = document.createElement('p');
    this.message.id = 'game-overlay-message';
    this.host.setAttribute('aria-describedby', this.message.id);
    this.actions = document.createElement('div');
    this.actions.className = 'game-actions';
    this.panel.append(this.heading, this.message, this.actions);
    this.host.append(this.panel);
    root.append(this.host);
    this.host.addEventListener(
      'click',
      (e) => {
        const button = e.target.closest('[data-game-action]');
        if (button) this.onAction(button.dataset.gameAction);
      },
      { signal: this.abort.signal },
    );
    this.host.addEventListener('keydown', (e) => this.keydown(e), {
      signal: this.abort.signal,
    });
    document.addEventListener(
      'focusin',
      (e) => {
        if (!this.host.hidden && !this.host.contains(e.target)) this.focus();
      },
      { signal: this.abort.signal },
    );
  }
  focus() {
    (this.actions.querySelector('button') || this.panel).focus({
      preventScroll: true,
    });
  }
  show(state, run = {}) {
    if (this.state === state && !this.host.hidden) return;
    this.state = state;
    const content = GameOverlayController.content(state, run);
    this.heading.textContent = content.title;
    this.message.textContent = content.message;
    this.message.setAttribute('role', state === 'error' ? 'alert' : 'status');
    this.actions.replaceChildren();
    for (const [index, label] of content.actions.entries()) {
      const button = document.createElement('button');
      button.textContent = label;
      button.dataset.gameAction = label;
      if (!index) button.className = 'primary';
      this.actions.append(button);
    }
    this.host.hidden = false;
    this.host.inert = false;
    this.canvas.inert = true;
    this.focus();
  }
  hide() {
    this.state = 'playing';
    this.host.hidden = true;
    this.host.inert = true;
    this.canvas.inert = false;
  }
  keydown(event) {
    event.stopPropagation();
    if (event.code === 'Escape') {
      event.preventDefault();
      if (this.state === 'paused') this.onAction('Resume');
      else if (this.state === 'error') this.onAction('Main Menu');
      return;
    }
    const buttons = [...this.actions.querySelectorAll('button')];
    if (['Tab', 'ArrowDown', 'ArrowUp'].includes(event.code)) {
      event.preventDefault();
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement),
        direction =
          event.code === 'ArrowUp' || (event.code === 'Tab' && event.shiftKey)
            ? -1
            : 1;
      buttons[(index + direction + buttons.length) % buttons.length].focus();
    }
  }
  dispose() {
    this.abort.abort();
    this.canvas.inert = false;
    this.host.remove();
  }
}
