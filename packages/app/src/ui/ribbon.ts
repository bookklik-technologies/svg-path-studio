/** Office-style ribbon: tabs, labeled tool groups, and quick access actions. */
import { SpsCommand } from '@bookklik/svg-path-studio';
import type { CommandType } from '@bookklik/svg-path-studio';
import type { Store } from '../state/store.js';
import type { Theme } from '../state/store.js';
import type { Renderer } from '../render/renderer.js';
import { buildPathPanel, buildConfigPanel, buildOpsPanel } from './sidebar.js';
import { icon } from './icons.js';

export interface RibbonActions {
  referenceImage: () => void;
  exportSvg: () => void;
  share: () => void;
  about: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

function button(label: string, iconName: string, action: () => void, large = true): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `sps-btn ${large ? 'sps-ribbon-button' : 'sps-ribbon-small'}`;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = `${icon(iconName)}<span>${label}</span>`;
  b.addEventListener('click', action);
  return b;
}

function body(panel: HTMLElement): HTMLElement {
  return panel.querySelector<HTMLElement>('.sps-panel-body')!;
}

function group(panel: HTMLElement, title: string, ...controls: HTMLElement[]): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'sps-ribbon-group';
  wrap.setAttribute('aria-label', title);
  const content = document.createElement('div');
  content.className = 'sps-ribbon-group-content';
  content.append(...controls);
  const label = document.createElement('div');
  label.className = 'sps-ribbon-group-label';
  label.textContent = title;
  wrap.append(content, label);
  panel.append(wrap);
  return wrap;
}

function labelAction(b: HTMLButtonElement, text: string): void {
  b.classList.remove('sps-btn-icon');
  b.classList.add('sps-ribbon-button');
  b.type = 'button';
  b.title = b.getAttribute('aria-label') ?? text;
  const label = document.createElement('span');
  label.textContent = text;
  b.append(label);
}

export function buildRibbon(store: Store, renderer: Renderer, actions: RibbonActions): HTMLElement {
  const ribbon = document.createElement('header');
  ribbon.className = 'sps-ribbon';
  ribbon.dataset.sps = 'ribbon';

  const titlebar = document.createElement('div');
  titlebar.className = 'sps-titlebar';
  const brand = document.createElement('strong');
  brand.className = 'sps-brand';
  const logo = document.createElement('img');
  logo.className = 'sps-brand-logo';
  logo.src = `${import.meta.env.BASE_URL}logo.svg`;
  logo.alt = '';
  logo.width = 24;
  logo.height = 24;
  brand.append(logo, document.createTextNode('SVG Path Studio'));
  const quick = document.createElement('div');
  quick.className = 'sps-quick-access';
  quick.setAttribute('role', 'group');
  quick.setAttribute('aria-label', 'Quick access');
  const undo = button('Undo', 'undo', () => store.undo(), false);
  const redo = button('Redo', 'redo', () => store.redo(), false);
  quick.append(undo, redo);
  const documentLabel = document.createElement('span');
  documentLabel.className = 'sps-document-label';
  const mode = document.createElement('span');
  mode.className = 'sps-canvas-mode';
  const theme = button('Theme', 'theme', () => store.update((s) => {
    s.settings.theme = s.settings.theme === 'dark' ? 'light' : 'dark';
  }), false);
  let themeIconState: Theme | null = null;
  const about = button('About', 'more', actions.about, false);
  titlebar.append(brand, quick, documentLabel, mode, theme, about);

  const tabstrip = document.createElement('div');
  tabstrip.className = 'sps-ribbon-tabstrip';
  const tabs = document.createElement('div');
  tabs.className = 'sps-ribbon-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Ribbon tabs');
  const content = document.createElement('div');
  content.className = 'sps-ribbon-content';
  content.id = 'sps-ribbon-content';
  const tabButtons: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];
  let activeIndex = 0;
  const scrollTools = document.createElement('div');
  scrollTools.className = 'sps-ribbon-scroll-tools';
  scrollTools.setAttribute('role', 'group');
  scrollTools.setAttribute('aria-label', 'Ribbon scrolling');
  const scrollPanel = (direction: number): void => {
    const panel = panels[activeIndex];
    panel.scrollBy({ left: direction * Math.max(160, panel.clientWidth * 0.75), behavior: 'instant' });
  };
  const previous = button('Scroll ribbon left', 'chevron', () => scrollPanel(-1), false);
  const next = button('Scroll ribbon right', 'chevron', () => scrollPanel(1), false);
  previous.classList.add('sps-ribbon-scroll-previous');
  next.classList.add('sps-ribbon-scroll-next');
  scrollTools.append(previous, next);
  const refreshOverflow = (): void => {
    const panel = panels[activeIndex];
    const overflow = panel.scrollWidth > panel.clientWidth + 1;
    const canLeft = panel.scrollLeft > 1;
    const canRight = panel.scrollLeft + panel.clientWidth < panel.scrollWidth - 1;
    scrollTools.hidden = !overflow || ribbon.classList.contains('sps-ribbon-collapsed');
    previous.disabled = !canLeft;
    next.disabled = !canRight;
    previous.setAttribute('aria-controls', panel.id);
    next.setAttribute('aria-controls', panel.id);
    content.classList.toggle('sps-can-scroll-left', overflow && canLeft);
    content.classList.toggle('sps-can-scroll-right', overflow && canRight);
  };
  const select = (index: number, focus = false): void => {
    ribbon.classList.remove('sps-ribbon-collapsed');
    const toggle = ribbon.querySelector<HTMLButtonElement>('.sps-ribbon-collapse');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Collapse ribbon');
      toggle.title = 'Collapse ribbon';
    }
    activeIndex = index;
    tabButtons.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) tabButtons[index].focus();
    requestAnimationFrame(refreshOverflow);
  };
  for (const name of ['Home', 'Insert', 'Transform', 'View']) {
    const index = tabButtons.length;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'sps-ribbon-tab';
    tab.textContent = name;
    tab.id = `sps-tab-${name.toLowerCase()}`;
    tab.setAttribute('role', 'tab');
    const panel = document.createElement('div');
    panel.className = `sps-ribbon-page sps-ribbon-${name.toLowerCase()}`;
    panel.id = `sps-ribbon-${name.toLowerCase()}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.setAttribute('aria-controls', panel.id);
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabButtons.length - 1
        : (activeIndex + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length;
      select(next, true);
    });
    panel.addEventListener('scroll', refreshOverflow, { passive: true });
    panel.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      const bounds = panel.getBoundingClientRect();
      const item = target.getBoundingClientRect();
      if (item.left < bounds.left + 12) panel.scrollBy({ left: item.left - bounds.left - 12 });
      else if (item.right > bounds.right - 12) panel.scrollBy({ left: item.right - bounds.right + 12 });
    });
    tabButtons.push(tab);
    panels.push(panel);
    tabs.append(tab);
    content.append(panel);
  }

  const [home, insert, transform, view] = panels;
  // Reuse the working file and path controls, arranged into horizontal groups.
  const pathControls = body(buildPathPanel(store, renderer));
  const textarea = pathControls.querySelector<HTMLTextAreaElement>('textarea')!;
  const error = pathControls.querySelector<HTMLElement>('.sps-error')!;
  const fileInput = pathControls.querySelector<HTMLInputElement>('input[type="file"]')!;
  const [open, save, clear, copy, add] = [...pathControls.querySelectorAll<HTMLButtonElement>('button')];
  [open, save, clear, copy, add].forEach((b, i) => labelAction(b, ['Open path', 'Save path', 'Clear', 'Copy path', 'Add point'][i]));
  clear.classList.add('sps-btn-danger');
  add.setAttribute('aria-label', 'Add point');
  add.title = 'Add point (l)';
  group(home, 'File & clipboard', open, save, copy, fileInput);
  group(home, 'Edit', clear, add);
  const data = document.createElement('div');
  data.className = 'sps-ribbon-path-data';
  data.append(textarea, error);
  group(home, 'Path data', data).classList.add('sps-ribbon-data-group');
  const exportSvg = button('Export SVG', 'download', actions.exportSvg);
  exportSvg.classList.add('sps-btn-outline');
  group(home, 'Export & share', exportSvg, button('Share', 'share', actions.share));

  const commandNames: Record<CommandType, string> = {
    M: 'Move', L: 'Line', H: 'Horizontal', V: 'Vertical', C: 'Cubic curve',
    S: 'Smooth cubic', Q: 'Quadratic', T: 'Smooth quadratic', A: 'Arc', Z: 'Close path'
  };
  const palette = document.createElement('div');
  palette.className = 'sps-insert-palette';
  const insertButtons = new Map<CommandType, HTMLButtonElement>();
  const prerequisites: Partial<Record<CommandType, string>> = {
    S: 'Smooth cubic requires a preceding Cubic curve (C) or Smooth cubic (S).',
    T: 'Smooth quadratic requires a preceding Quadratic (Q) or Smooth quadratic (T).',
    Z: 'Close path requires a preceding command that is not Close path (Z).'
  };
  for (const type of ['M', 'L', 'H', 'V', 'C', 'S', 'Q', 'T', 'A', 'Z'] as CommandType[]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sps-btn sps-insert-command';
    b.title = `${commandNames[type]} (${type.toLowerCase()})`;
    b.setAttribute('aria-label', `${commandNames[type]} (${type})`);
    b.setAttribute('aria-keyshortcuts', type.toLowerCase());
    if (prerequisites[type]) {
      b.title += ` — ${prerequisites[type]}`;
      const description = document.createElement('span');
      description.className = 'sps-sr-only';
      description.id = `sps-command-help-${type.toLowerCase()}`;
      description.textContent = prerequisites[type]!;
      palette.append(description);
      b.setAttribute('aria-describedby', description.id);
    }
    const letter = document.createElement('b');
    letter.textContent = type;
    const label = document.createElement('span');
    label.textContent = commandNames[type];
    b.append(letter, label);
    b.addEventListener('click', () => {
      const anchor = store.state.selection ?? store.state.path.commands.at(-1);
      if (type === 'Z' && anchor) {
        store.beginGesture();
        store.update((s) => {
          const cmd = SpsCommand.make('Z', false, []);
          s.path.insert(cmd, anchor);
          s.selection = cmd;
          s.insertion = null;
        });
        store.endGesture();
      } else {
        store.update((s) => {
          s.selection = anchor ?? null;
          s.insertion = { type: type === 'Z' ? null : type };
        });
      }
    });
    palette.append(b);
    insertButtons.set(type, b);
  }
  group(insert, 'Path commands', palette);
  const clearImage = button('Clear image', 'clear', () => {
    const image = store.state.referenceImage;
    if (!image) return;
    store.update((s) => { s.referenceImage = null; });
    URL.revokeObjectURL(image.url);
  });
  group(insert, 'Reference', button('Reference image', 'image', actions.referenceImage), clearImage)
    .classList.add('sps-ribbon-reference');
  const insertionHint = document.createElement('p');
  insertionHint.className = 'sps-ribbon-note';
  insertionHint.setAttribute('role', 'status');
  insertionHint.setAttribute('aria-live', 'polite');
  group(insert, 'Placement', insertionHint);

  const operations = body(buildOpsPanel(store)).firstElementChild!;
  const operationLabels = ['Scale', 'Translate', 'Rotate', 'Round coordinates', 'Coordinates', 'Path tools'];
  [...operations.children].forEach((row, i) => {
    const controls = row as HTMLElement;
    controls.classList.add('sps-ribbon-operation');
    for (const input of controls.querySelectorAll<HTMLInputElement>('input')) {
      const field = document.createElement('label');
      field.className = 'sps-field';
      const label = document.createElement('span');
      label.textContent = input.dataset.spsLabel === 'Number of decimals' ? 'Decimals' : input.dataset.spsLabel ?? 'Value';
      input.replaceWith(field);
      field.append(label, input);
    }
    group(transform, operationLabels[i], controls);
  });

  const config = body(buildConfigPanel(store));
  const [viewBox, checks, precision] = [...config.children] as HTMLElement[];
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight, viewBoxLock] = [...viewBox.children];
  const viewBoxFields = document.createElement('div');
  viewBoxFields.className = 'sps-ribbon-viewbox-fields';
  for (const fields of [[viewBoxX, viewBoxY], [viewBoxWidth, viewBoxHeight]]) {
    const row = document.createElement('div');
    row.className = 'sps-ribbon-viewbox-row';
    row.append(...fields);
    viewBoxFields.append(row);
  }
  viewBox.className = 'sps-ribbon-viewbox-controls';
  viewBox.append(viewBoxFields, viewBoxLock);
  const [snap, preview, fill, minify, ticks, numbers] = [...checks.children] as HTMLElement[];
  const navigation = document.createElement('div');
  navigation.className = 'sps-ribbon-navigation';
  navigation.append(button('Fit path', 'fit', () => renderer.fitToPath(), false),
    button('Zoom in', 'zoomIn', actions.zoomIn, false), button('Reset view', 'center', actions.resetView, false),
    button('Zoom out', 'zoomOut', actions.zoomOut, false));
  group(view, 'Navigate', navigation);
  group(view, 'ViewBox', viewBox).classList.add('sps-ribbon-viewbox');
  const gridChecks = document.createElement('div');
  gridChecks.className = 'sps-ribbon-stack sps-ribbon-grid-checks';
  gridChecks.append(snap, ticks, numbers);
  group(view, 'Grid & rulers', gridChecks);
  const displayChecks = document.createElement('div');
  displayChecks.className = 'sps-ribbon-stack';
  displayChecks.append(preview, fill);
  group(view, 'Display', displayChecks);
  const panelToggle = document.createElement('label');
  panelToggle.className = 'sps-check';
  const commandsToggle = document.createElement('input');
  commandsToggle.type = 'checkbox';
  commandsToggle.setAttribute('aria-controls', 'sps-commands-sidebar');
  commandsToggle.addEventListener('change', () => store.update((s) => {
    s.settings.commandsSidebar = commandsToggle.checked;
  }));
  panelToggle.append(commandsToggle, document.createTextNode('Commands sidebar'));
  group(view, 'Panels', panelToggle);
  const output = document.createElement('div');
  output.className = 'sps-ribbon-stack';
  output.append(minify, precision);
  group(view, 'SVG output', output);

  const collapse = button('Collapse ribbon', 'chevron', () => {
    const collapsed = ribbon.classList.toggle('sps-ribbon-collapsed');
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.title = collapsed ? 'Expand ribbon' : 'Collapse ribbon';
    collapse.setAttribute('aria-label', collapse.title);
    refreshOverflow();
  }, false);
  collapse.classList.add('sps-ribbon-collapse');
  collapse.setAttribute('aria-expanded', 'true');
  collapse.setAttribute('aria-label', 'Collapse ribbon');
  collapse.setAttribute('aria-controls', content.id);
  tabstrip.append(tabs, scrollTools, collapse);
  ribbon.append(titlebar, tabstrip, content);
  select(0);
  const resizeObserver = new ResizeObserver(refreshOverflow);
  panels.forEach((panel) => resizeObserver.observe(panel));

  const refresh = (): void => {
    undo.disabled = !store.canUndo();
    redo.disabled = !store.canRedo();
    clearImage.disabled = !store.state.referenceImage;
    commandsToggle.checked = store.state.settings.commandsSidebar;
    mode.textContent = store.state.settings.preview ? 'Preview' : 'Edit path';
    documentLabel.textContent = `${store.state.path.commands.length} commands`;
    // Theme button shows the mode it switches to: sun in dark, moon in light.
    if (themeIconState !== store.state.settings.theme) {
      themeIconState = store.state.settings.theme;
      theme.innerHTML = `${icon(themeIconState === 'dark' ? 'sun' : 'moon')}<span>Theme</span>`;
    }
    const preceding = store.state.selection ?? store.state.path.commands.at(-1);
    insertButtons.get('S')!.disabled = !preceding || !['C', 'S'].includes(preceding.type);
    insertButtons.get('T')!.disabled = !preceding || !['Q', 'T'].includes(preceding.type);
    insertButtons.get('Z')!.disabled = !preceding || preceding.type === 'Z';
    for (const [type, b] of insertButtons) b.setAttribute('aria-pressed', String(store.state.insertion?.type === type));
    add.setAttribute('aria-pressed', String(store.state.insertion?.type === 'L'));
    const activeCommand = store.state.insertion?.type;
    const hint = activeCommand
      ? `${commandNames[activeCommand]} (${activeCommand}) active. Click on the canvas to place it. Press Esc to cancel.`
      : 'Choose a command, then click on the canvas to place it. Press Esc to cancel.';
    if (insertionHint.textContent !== hint) insertionHint.textContent = hint;
  };
  store.subscribe(refresh);
  refresh();
  return ribbon;
}
