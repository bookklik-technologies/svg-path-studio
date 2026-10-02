/** App bootstrap: assembles shell, wires store/renderer/UI. */

import './styles/main.css';
import { Store } from './state/store.js';
import { Renderer } from './render/renderer.js';
import { attachCanvasEvents, zoomAt } from './render/canvasEvents.js';
import { buildRibbon } from './ui/ribbon.js';
import { buildCommandsSidebar } from './ui/commands.js';
import { openExportDialog, openShareDialog, openAboutDialog } from './ui/dialogs.js';
import { makeShareUrl } from './io/share.js';
import { attachKeyboard } from './ui/keyboard.js';
import { icon } from './ui/icons.js';
import { applyFromHash, persistSession, readSession } from './io/share.js';

const appRoot = document.getElementById('app')!;
appRoot.classList.add('sps-root');
appRoot.dataset.sps = 'root';

const store = new Store();
const workspace = document.createElement('div');
workspace.className = 'sps-workspace';
appRoot.appendChild(workspace);
const canvasWrap = document.createElement('div');
canvasWrap.className = 'sps-canvas-wrap';
workspace.appendChild(canvasWrap);

const renderer = new Renderer(store, canvasWrap);
const ribbon = buildRibbon(store, renderer, {
  referenceImage: () => pickReferenceImage(store),
  exportSvg: () => openExportDialog(store),
  share: () => openShareDialog(store, makeShareUrl),
  about: () => openAboutDialog(),
  zoomIn: () => zoomCenter(renderer, store, 1 / 1.25),
  zoomOut: () => zoomCenter(renderer, store, 1.25),
  resetView: () => store.update((s) => (s.viewBox = { x: -1, y: -1, width: 15, height: 15 }))
});
appRoot.insertBefore(ribbon, workspace);
workspace.appendChild(buildCommandsSidebar(store, renderer));

// Toolbars
const bottomTools = document.createElement('div');
bottomTools.className = 'sps-toolbar sps-toolbar-br';
canvasWrap.append(bottomTools);
bottomTools.setAttribute('role', 'toolbar');
bottomTools.setAttribute('aria-label', 'Canvas view controls');

const statusbar = document.createElement('div');
statusbar.className = 'sps-statusbar';
const hint = document.createElement('span');
const gridStatus = document.createElement('span');
statusbar.append(hint, gridStatus);
canvasWrap.appendChild(statusbar);

const tool = (label: string, iconName: string, onClick: () => void, disableIf?: () => boolean): HTMLButtonElement => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sps-btn sps-btn-icon';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icon(iconName);
  b.addEventListener('click', onClick);
  if (disableIf) {
    const refresh = () => (b.disabled = disableIf());
    store.subscribe(refresh);
    refresh();
  }
  return b;
};

const viewScale = document.createElement('span');
viewScale.className = 'sps-view-scale';
const fit = tool('Fit path to canvas', 'fit', () => renderer.fitToPath());
fit.classList.remove('sps-btn-icon');
fit.appendChild(document.createTextNode('Fit path'));

// Keep navigation together, with a visible fit action and current scale.
bottomTools.append(
  tool('Zoom out', 'zoomOut', () => zoomCenter(renderer, store, 1.25)),
  viewScale,
  tool('Zoom in', 'zoomIn', () => zoomCenter(renderer, store, 1 / 1.25)),
  tool('Reset view', 'center', () => store.update((s) => (s.viewBox = { x: -1, y: -1, width: 15, height: 15 }))),
  fit
);

const refreshCanvasUI = (): void => {
  const s = store.state;
  document.documentElement.dataset.theme = s.settings.theme;
  hint.textContent = s.insertion
    ? `Click to place ${s.insertion.type} · Esc to cancel`
    : s.settings.preview
      ? 'Preview · Drag to pan · Scroll to zoom'
      : 'Drag points to edit · Space + drag to pan · Scroll to zoom';
  const scale = renderer.scaleTo(s).sx;
  viewScale.textContent = `${Number(scale.toPrecision(3))} px / unit`;
  gridStatus.textContent = `Grid ${renderer.gridStep()} · Snap ${s.settings.snap ? 'on' : 'off'}`;
};
store.subscribe(refreshCanvasUI);
new ResizeObserver(refreshCanvasUI).observe(canvasWrap);
refreshCanvasUI();

// Canvas events + keyboard
attachCanvasEvents(renderer, store);
attachKeyboard(store, () => {
  /* The statusbar reacts to the insertion state. */
});

// Boot sequence: URL hash takes precedence over localStorage session.
void (async () => {
  const applied = await applyFromHash(store, location.hash);
  if (!applied) {
    const session = readSession();
    if (session?.d) {
      store.update((s) => {
        s.path = new (s.path.constructor as new (d: string) => typeof s.path)(session.d);
        s.viewBox = { ...session.vb };
        Object.assign(s.settings, session.settings ?? {});
        s.path.refreshAbsolutePositions();
      });
    } else {
      renderer.fitToPath();
    }
  }
})();

// Persist session on every committed change.
store.subscribe(() => persistSession(store));

// Service worker for offline use.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {
      /* offline support unavailable (e.g. dev server without sw) */
    });
  });
}

function zoomCenter(renderer: Renderer, store: Store, factor: number): void {
  const r = (renderer as unknown as { root: SVGSVGElement }).root.getBoundingClientRect();
  zoomAt(renderer, store, r.left + r.width / 2, r.top + r.height / 2, factor);
}

function pickReferenceImage(store: Store): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const previousImage = store.state.referenceImage;
    store.update((s) => {
      s.referenceImage = { url, opacity: 0.4 };
      s.settings.preview = false;
    });
    if (previousImage) URL.revokeObjectURL(previousImage.url);
  });
  input.click();
}
