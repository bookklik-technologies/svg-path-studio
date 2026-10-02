/** Shared editor controls, arranged by the ribbon UI. */

import type { Store } from '../state/store.js';
import type { Renderer } from '../render/renderer.js';
import { SpsPath } from '@svg-path-studio/core';
import { icon } from './icons.js';
import { openCommandMenu } from './menu.js';
import { rewriteRelative, rewriteAbsolute } from './pathHelpers.js';
import { reversePath, optimizePath } from '@svg-path-studio/core';

function panelFrame(title: string, count?: HTMLElement): { wrap: HTMLElement; body: HTMLElement } {
  const wrap = document.createElement('section');
  wrap.className = 'sps-panel';
  const header = document.createElement('div');
  header.className = 'sps-panel-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'true');
  header.innerHTML = `<span>${title}${count ? '' : ''}</span><span style="display:flex;align-items:center;gap:6px">${
    count ? count.outerHTML : ''
  }<span>${icon('chevron')}</span></span>`;
  const body = document.createElement('div');
  body.className = 'sps-panel-body';
  const toggle = (): void => {
    const collapsed = wrap.classList.toggle('sps-collapsed');
    header.setAttribute('aria-expanded', String(!collapsed));
  };
  header.addEventListener('click', toggle);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  wrap.appendChild(header);
  wrap.appendChild(body);
  return { wrap, body };
}

export function buildPathPanel(store: Store, _renderer: Renderer): HTMLElement {
  const charcount = document.createElement('span');
  charcount.className = 'sps-charcount';
  const { wrap, body } = panelFrame('Path', charcount);

  const ta = document.createElement('textarea');
  ta.className = 'sps-textarea';
  ta.spellcheck = false;
  ta.setAttribute('aria-label', 'Path data');
  ta.dataset.sps = 'path-input';
  ta.value = store.state.path.asString(store.state.settings.precision, store.state.settings.minify);
  ta.addEventListener('input', () => {
    store.setPath(ta.value);
  });
  store.subscribe((s) => {
    const d = s.path.asString(s.settings.precision, s.settings.minify);
    if (ta.value !== d && document.activeElement !== ta) ta.value = d;
    charcount.textContent = `${ta.value.length}`;
    errLine.textContent = s.parseError ? `⚠ ${s.parseError.message}` : '';
  });

  const errLine = document.createElement('div');
  errLine.className = 'sps-error';
  errLine.setAttribute('role', 'alert');

  const btnRow = document.createElement('div');
  btnRow.className = 'sps-field-row';

  const open = document.createElement('button');
  open.className = 'sps-btn sps-btn-icon';
  open.setAttribute('aria-label', 'Open path file');
  open.innerHTML = icon('folder');
  open.addEventListener('click', () => fileInput.click());

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.svg,.txt';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    const d = file.name.endsWith('.svg') ? extractFirstPathD(text) : text.trim();
    if (d) store.setPath(d);
    fileInput.value = '';
  });

  const save = document.createElement('button');
  save.className = 'sps-btn sps-btn-icon';
  save.setAttribute('aria-label', 'Save path file');
  save.innerHTML = icon('save');
  save.addEventListener('click', () => {
    const blob = new Blob([store.state.path.asString(store.state.settings.precision, store.state.settings.minify)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'path.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const clear = document.createElement('button');
  clear.className = 'sps-btn sps-btn-icon';
  clear.setAttribute('aria-label', 'Clear path');
  clear.innerHTML = icon('clear');
  clear.addEventListener('click', () => {
    store.setPath('M 0 0');
    store.update((s) => {
      s.selection = null;
    });
  });

  const copy = document.createElement('button');
  copy.className = 'sps-btn sps-btn-icon';
  copy.setAttribute('aria-label', 'Copy path to clipboard');
  copy.innerHTML = icon('copy');
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(store.state.path.asString(store.state.settings.precision, store.state.settings.minify));
  });

  const add = document.createElement('button');
  add.className = 'sps-btn sps-btn-icon sps-btn-primary';
  add.setAttribute('aria-label', 'Add command');
  add.innerHTML = icon('plus');
  add.addEventListener('click', () => {
    store.update((s) => {
      s.insertion = { type: 'L' };
      s.selection = s.selection ?? s.path.commands[s.path.commands.length - 1] ?? null;
    });
  });

  btnRow.append(open, fileInput, save, clear, copy);
  const spacer = document.createElement('span');
  spacer.style.cssText = 'flex:1';
  btnRow.appendChild(spacer);
  btnRow.appendChild(add);

  body.appendChild(ta);
  body.appendChild(errLine);
  body.appendChild(btnRow);
  return wrap;
}

export function buildConfigPanel(store: Store): HTMLElement {
  const { wrap, body } = panelFrame('Configuration');

  const row1 = document.createElement('div');
  row1.className = 'sps-field-row';

  const mkField = (label: string, value: number, step = 'any'): { field: HTMLElement; input: HTMLInputElement } => {
    const f = document.createElement('label');
    f.className = 'sps-field';
    f.innerHTML = `<span>${label}</span>`;
    const input = document.createElement('input');
    input.className = 'sps-input';
    input.type = 'number';
    input.step = step;
    input.value = String(value);
    f.appendChild(input);
    return { field: f, input };
  };

  const x = mkField('x', store.state.viewBox.x);
  const y = mkField('y', store.state.viewBox.y);
  const w = mkField('width', store.state.viewBox.width);
  const h = mkField('height', store.state.viewBox.height);

  const syncVB = (src: HTMLInputElement) => {
    store.beginGesture();
    store.update((s) => {
      const ratio = s.viewBox.width / s.viewBox.height;
      let width = Math.abs(Number(w.input.value)) || 1;
      let height = Math.abs(Number(h.input.value)) || 1;
      if (s.lockAspect) {
        if (src === w.input) height = width / ratio;
        if (src === h.input) width = height * ratio;
      }
      s.viewBox = {
        x: Number(x.input.value) || 0,
        y: Number(y.input.value) || 0,
        width, height
      };
    });
    store.endGesture();
  };
  for (const i of [x.input, y.input, w.input, h.input]) {
    i.addEventListener('change', () => syncVB(i));
  }

  store.subscribe((s) => {
    for (const [input, key] of [
      [x.input, 'x'],
      [y.input, 'y'],
      [w.input, 'width'],
      [h.input, 'height']
    ] as const) {
      const v = s.viewBox[key];
      if (document.activeElement !== input) input.value = String(round(v, 3));
    }
  });

  const lock = document.createElement('button');
  lock.className = 'sps-btn sps-btn-icon';
  lock.setAttribute('aria-label', 'Lock aspect ratio');
  lock.innerHTML = icon('lock');
  lock.setAttribute('aria-pressed', String(store.state.lockAspect));
  store.subscribe((s) => {
    lock.setAttribute('aria-pressed', String(s.lockAspect));
    lock.title = s.lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio';
    lock.setAttribute('aria-label', lock.title);
  });
  lock.addEventListener('click', () => {
    store.update((s) => {
      s.lockAspect = !s.lockAspect;
    });
  });

  row1.append(x.field, y.field, w.field, h.field, lock);

  const mkCheck = (label: string, get: () => boolean, set: (v: boolean) => void): HTMLElement => {
    const l = document.createElement('label');
    l.className = 'sps-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = get();
    store.subscribe(() => { cb.checked = get(); });
    cb.addEventListener('change', () => {
      store.beginGesture();
      store.update((_s) => set(cb.checked));
      store.endGesture();
    });
    l.appendChild(cb);
    l.appendChild(document.createTextNode(label));
    return l;
  };

  const row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0 12px';
  row2.appendChild(mkCheck('Snap to Grid', () => store.state.settings.snap, (v) => store.update((s) => (s.settings.snap = v))));
  row2.appendChild(mkCheck('Preview', () => store.state.settings.preview, (v) => store.update((s) => (s.settings.preview = v))));
  row2.appendChild(mkCheck('Fill', () => store.state.settings.fill, (v) => store.update((s) => (s.settings.fill = v))));
  row2.appendChild(mkCheck('Minify output', () => store.state.settings.minify, (v) => store.update((s) => (s.settings.minify = v))));
  row2.appendChild(mkCheck('Show Ticks', () => store.state.settings.ticks, (v) => store.update((s) => (s.settings.ticks = v))));
  row2.appendChild(mkCheck('Show tick numbers', () => store.state.settings.tickNumbers, (v) => store.update((s) => (s.settings.tickNumbers = v))));

  const prec = mkField('Point Precision', store.state.settings.precision, '1');
  store.subscribe((s) => {
    if (document.activeElement !== prec.input) prec.input.value = String(s.settings.precision);
  });
  prec.input.addEventListener('change', () => {
    store.update((s) => {
      s.settings.precision = Math.min(8, Math.max(0, Math.round(Number(prec.input.value) || 0)));
      prec.input.value = String(s.settings.precision);
    });
  });
  const precWrap = document.createElement('div');
  precWrap.className = 'sps-field-row';
  precWrap.appendChild(prec.field);

  body.appendChild(row1);
  body.appendChild(row2);
  body.appendChild(precWrap);
  return wrap;
}

export function buildOpsPanel(store: Store): HTMLElement {
  const { wrap, body } = panelFrame('Path Operations');

  const mkNum = (label: string, value: number, step = 'any'): HTMLInputElement => {
    const f = document.createElement('label');
    f.className = 'sps-field';
    f.innerHTML = `<span>${label}</span>`;
    const input = document.createElement('input');
    input.className = 'sps-input';
    input.type = 'number';
    input.step = step;
    input.value = String(value);
    f.appendChild(input);
    input.dataset.spsLabel = label;
    return input;
  };

  const mkBtn = (label: string, onClick: () => void, primary = false): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = 'sps-btn' + (primary ? ' sps-btn-primary' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-direction:column;gap:8px';

  // Scale
  {
    const row = document.createElement('div');
    row.className = 'sps-field-row';
    const sx = mkNum('Scale X', 1);
    const sy = mkNum('Scale Y', 1);
    const btn = mkBtn('Scale', () => {
      store.beginGesture();
      store.update((s) => {
        s.path.scale(Number(sx.value) || 1, Number(sy.value) || 1);
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    });
    row.append(sx, sy, btn);
    grid.appendChild(row);
  }
  // Translate
  {
    const row = document.createElement('div');
    row.className = 'sps-field-row';
    const tx = mkNum('Translate X', 0);
    const ty = mkNum('Translate Y', 0);
    const btn = mkBtn('Translate', () => {
      store.beginGesture();
      store.update((s) => {
        s.path.translate(Number(tx.value) || 0, Number(ty.value) || 0);
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    });
    row.append(tx, ty, btn);
    grid.appendChild(row);
  }
  // Rotate
  {
    const row = document.createElement('div');
    row.className = 'sps-field-row';
    const ox = mkNum('Origin X', 0);
    const oy = mkNum('Origin Y', 0);
    const ang = mkNum('Angle', 0);
    const btn = mkBtn('Rotate', () => {
      store.beginGesture();
      store.update((s) => {
        s.path.rotate(Number(ox.value) || 0, Number(oy.value) || 0, Number(ang.value) || 0);
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    });
    row.append(ox, oy, ang, btn);
    grid.appendChild(row);
  }
  // Round
  {
    const row = document.createElement('div');
    row.className = 'sps-field-row';
    const dec = mkNum('Number of decimals', store.state.settings.precision, '1');
    const btn = mkBtn('Round', () => {
      store.beginGesture();
      store.update((s) => {
        const d = Math.min(8, Math.max(0, Math.round(Number(dec.value) || 0)));
        const str = s.path.asString(d, false);
        s.path = new SpsPath(str);
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    });
    row.append(dec, btn);
    grid.appendChild(row);
  }
  // Convert relative/absolute
  {
    const row = document.createElement('div');
    row.className = 'sps-field-row';
    const rel = mkBtn('Convert to relative', () => {
      store.beginGesture();
      store.update((s) => {
        s.path.setRelative(true);
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    });
    const abs = mkBtn('Convert to absolute', () => {
      store.beginGesture();
      store.update((s) => {
        s.path.setRelative(false);
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    });
    rel.style.flex = '1';
    abs.style.flex = '1';
    row.append(rel, abs);
    grid.appendChild(row);
  }
  // Reverse / Optimize
  {
    const row = document.createElement('div');
    row.className = 'sps-field-row';
    const rev = mkBtn('Reverse', () => {
      store.beginGesture();
      store.update((s) => {
        reversePath(s.path);
        s.path.refreshAbsolutePositions();
        s.selection = null;
      });
      store.endGesture();
    });
    const opt = mkBtn('Optimize', () => {
      store.beginGesture();
      store.update((s) => {
        optimizePath(s.path, s.optimizeOptions);
        s.path.refreshAbsolutePositions();
        s.selection = null;
      });
      store.endGesture();
    }, true);
    rev.style.flex = '1';
    opt.style.flex = '1';
    row.append(rev, opt);
    grid.appendChild(row);
  }

  body.appendChild(grid);
  return wrap;
}

export function buildCommandsPanel(store: Store, renderer: Renderer): HTMLElement {
  const list = document.createElement('div');
  const { wrap, body } = panelFrame('Commands');
  body.appendChild(list);
  let lastSignature = '';
  const refreshSelection = (): void => {
    for (const row of list.querySelectorAll<HTMLElement>('.sps-cmd-row')) {
      const selected = row.dataset.spsCmd === String(store.state.selection?.id);
      row.classList.toggle('sps-active', selected);
      row.setAttribute('aria-current', String(selected));
    }
  };

  const rebuild = (): void => {
    const state = store.state;
    const signature = `${state.path.asString(10, false)}|${state.path.commands.map((c) => c.id).join(',')}`;
    if (signature === lastSignature) {
      refreshSelection();
      return;
    }
    lastSignature = signature;
    const active = document.activeElement as HTMLElement | null;
    const activeRow = active && list.contains(active) ? active.closest<HTMLElement>('.sps-cmd-row') : null;
    const focusedCmd = activeRow?.dataset.spsCmd;
    const focusedValue = active?.dataset.spsValue;
    const focusedFlag = active?.dataset.spsFlag;
    list.replaceChildren();
    state.path.refreshAbsolutePositions();

    state.path.commands.forEach((cmd, idx) => {
      const row = document.createElement('div');
      row.className = 'sps-cmd-row';
      row.dataset.sps = 'cmd-row';
      row.dataset.spsCmd = String(cmd.id);
      row.tabIndex = 0;
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', `Command ${idx + 1}: ${cmd.letter}`);
      if (state.selection === cmd) row.classList.add('sps-active');

      const number = document.createElement('span');
      number.className = 'sps-cmd-index';
      number.textContent = String(idx + 1);
      row.appendChild(number);

      const chip = document.createElement('span');
      chip.className = `sps-cmd-chip ${cmd.relative ? 'sps-relative' : 'sps-absolute'}`;
      chip.textContent = cmd.letter;
      chip.title = cmd.relative ? 'relative' : 'absolute';
      chip.addEventListener('click', () => {
        // toggle relative/absolute for this command
        store.beginGesture();
        store.update((s) => {
          const target = !cmd.relative;
          const S = cmd.absStart;
          if (target) {
            rewriteRelative(cmd, S);
          } else {
            rewriteAbsolute(cmd, S);
          }
          s.path.refreshAbsolutePositions();
        });
        store.endGesture();
      });
      row.appendChild(chip);

      // value inputs
      cmd.values.forEach((v, vi) => {
        const input = document.createElement('input');
        input.className = 'sps-input';
        input.type = 'number';
        input.step = 'any';
        input.value = String(round(v, 4));
        input.dataset.spsValue = String(vi);
        input.setAttribute('aria-label', `${cmd.letter} value ${vi + 1}`);
        input.addEventListener('change', () => {
          store.beginGesture();
          store.update((s) => {
            cmd.values[vi] = Number(input.value) || 0;
            s.path.refreshAbsolutePositions();
          });
          store.endGesture();
        });
        row.appendChild(input);
      });

      // A-flags
      if (cmd.type === 'A') {
        for (const [flag, label] of [
          ['largeArc', 'large-arc'],
          ['sweep', 'sweep']
        ] as const) {
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = cmd[flag];
          cb.title = label;
          cb.dataset.spsFlag = flag;
          cb.setAttribute('aria-label', `Command ${idx + 1} ${label}`);
          cb.addEventListener('change', () => {
            store.beginGesture();
            store.update((s) => {
              (cmd as unknown as Record<string, boolean>)[flag] = cb.checked;
              s.path.refreshAbsolutePositions();
            });
            store.endGesture();
          });
          row.appendChild(cb);
        }
      }

      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('input, button')) return;
        store.update((s) => {
          s.selection = cmd;
        });
      });
      row.addEventListener('focusin', () => {
        if (store.state.selection !== cmd) store.update((s) => { s.selection = cmd; });
      });
      row.addEventListener('keydown', (e) => {
        if (e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        e.stopPropagation();
        store.update((s) => { s.selection = cmd; });
      });

      const more = document.createElement('button');
      more.className = 'sps-cmd-more';
      more.setAttribute('aria-label', `Command ${idx + 1} menu`);
      more.innerHTML = icon('more');
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        openCommandMenu(store, renderer, cmd, r.left, r.bottom + 2);
      });
      row.appendChild(more);

      list.appendChild(row);
    });
    refreshSelection();
    if (!state.path.commands.length) {
      const empty = document.createElement('p');
      empty.className = 'sps-commands-empty';
      empty.textContent = 'Add a point from the ribbon to start a path.';
      list.append(empty);
    }
    if (focusedCmd) {
      const row = list.querySelector<HTMLElement>(`[data-sps-cmd="${focusedCmd}"]`);
      const selector = focusedValue !== undefined ? `[data-sps-value="${focusedValue}"]`
        : focusedFlag !== undefined ? `[data-sps-flag="${focusedFlag}"]` : null;
      if (selector) row?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    }
  };

  store.subscribe(rebuild);
  rebuild();
  return wrap;
}

function round(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

/** Extract the first <path> d attribute from an SVG file's text. */
export function extractFirstPathD(svgText: string): string | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const path = doc.querySelector('path');
  return path?.getAttribute('d') ?? null;
}
