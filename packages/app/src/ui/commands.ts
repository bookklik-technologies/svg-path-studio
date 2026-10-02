/** Persistent command inspector beside the canvas. */
import type { Store } from '../state/store.js';
import type { Renderer } from '../render/renderer.js';
import { buildCommandsPanel } from './sidebar.js';
import { icon } from './icons.js';

export function buildCommandsSidebar(store: Store, renderer: Renderer): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sps-commands-sidebar';
  sidebar.id = 'sps-commands-sidebar';
  sidebar.dataset.sps = 'commands-sidebar';
  sidebar.setAttribute('aria-labelledby', 'sps-commands-title');

  const header = document.createElement('div');
  header.className = 'sps-commands-header';
  const title = document.createElement('h2');
  title.id = 'sps-commands-title';
  title.textContent = 'Commands';
  const count = document.createElement('span');
  count.className = 'sps-command-count';
  const hide = document.createElement('button');
  hide.type = 'button';
  hide.className = 'sps-btn sps-commands-hide';
  hide.title = 'Hide Commands sidebar';
  hide.setAttribute('aria-label', hide.title);
  hide.innerHTML = icon('clear');
  hide.addEventListener('click', () => store.update((s) => {
    s.settings.commandsSidebar = false;
  }));
  header.append(title, count, hide);

  const scroll = document.createElement('div');
  scroll.className = 'sps-commands-scroll';
  const panel = buildCommandsPanel(store, renderer);
  const list = panel.querySelector<HTMLElement>('.sps-panel-body')!.firstElementChild as HTMLElement;
  list.className = 'sps-command-list';
  scroll.append(list);

  const hint = document.createElement('div');
  hint.className = 'sps-commands-hint';
  hint.textContent = 'Select a row to edit · … for actions';
  sidebar.append(header, scroll, hint);

  let lastSelection: number | null = null;
  let wasVisible = false;
  const refresh = (): void => {
    count.textContent = String(store.state.path.commands.length);
    const visible = store.state.settings.commandsSidebar;
    const opening = visible && !wasVisible;
    wasVisible = visible;
    const hadFocus = sidebar.contains(document.activeElement);
    sidebar.hidden = !visible;
    if (!visible) {
      if (hadFocus) document.querySelector<SVGSVGElement>('[data-sps="canvas"]')?.focus({ preventScroll: true });
      return;
    }
    const selected = store.state.selection?.id ?? null;
    if (selected === lastSelection && !opening) return;
    lastSelection = selected;
    const row = list.querySelector<HTMLElement>('.sps-active');
    if (!row || !sidebar.isConnected) return;
    // Scroll only the inspector, keeping the selected point and ribbon in place.
    const bounds = scroll.getBoundingClientRect();
    const target = row.getBoundingClientRect();
    if (target.top < bounds.top + 8) scroll.scrollTop += target.top - bounds.top - 8;
    else if (target.bottom > bounds.bottom - 8) scroll.scrollTop += target.bottom - bounds.bottom + 8;
  };
  store.subscribe(refresh);
  refresh();
  return sidebar;
}
