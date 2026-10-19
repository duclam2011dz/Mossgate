import { Guards } from '../shared/guards.ts';
export type Page = 'menu' | 'editor' | 'game';
export class PageNavigation {
  static url(page: Page, parameters: Record<string, string> = {}) {
    const name = {
      menu: 'index.html',
      editor: 'editor.html',
      game: 'game.html',
    }[page];
    if (!name) throw new Error('Unknown page.');
    const url = new URL(`${import.meta.env.BASE_URL}${name}`, location.href);
    for (const [key, value] of Object.entries(parameters))
      url.searchParams.set(key, value);
    return url.href;
  }
  static go(page: Page, parameters?: Record<string, string>) {
    location.assign(this.url(page, parameters));
  }
  static legacy() {
    const page = location.hash.replace(/^#\/?/, '');
    if (page === 'editor' || page === 'play') {
      location.replace(this.url(page === 'play' ? 'game' : 'editor'));
      return true;
    }
    if (page)
      history.replaceState(null, '', location.pathname + location.search);
    return false;
  }
  static error(root: HTMLElement, error: unknown) {
    root.replaceChildren();
    const box = document.createElement('section'),
      message = document.createElement('p'),
      link = document.createElement('a');
    box.className = 'page-error';
    message.setAttribute('role', 'alert');
    message.textContent = Guards.error(error);
    link.href = this.url('menu');
    link.textContent = 'Main Menu';
    box.append(message, link);
    root.append(box);
  }
}
