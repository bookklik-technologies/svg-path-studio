/**
 * Canvas interactions: pan, zoom, drag handles, insertion placement.
 * Pointer capture keeps gestures alive outside the element.
 */

import type { Renderer } from './renderer.js';
import type { Store } from '../state/store.js';
import { SpsCommand } from '@svg-path-studio/core';
import { openCommandMenu } from '../ui/menu.js';

export function attachCanvasEvents(renderer: Renderer, store: Store): void {
  const svg = renderer['root'] as SVGSVGElement;

  let mode: 'idle' | 'pan' | 'drag-end' | 'drag-control' = 'idle';
  let panStart: { x: number; y: number; vx: number; vy: number } | null = null;
  let dragCmd: SpsCommand | null = null;
  let dragCi = 0;
  let moved = false;
  let spaceHeld = false;

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || (e.target as Element).closest('input, textarea, button, [contenteditable], dialog')) return;
    e.preventDefault();
    spaceHeld = true;
    svg.classList.add('sps-pan-ready');
  });
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    spaceHeld = false;
    svg.classList.remove('sps-pan-ready');
  });
  window.addEventListener('blur', () => {
    spaceHeld = false;
    svg.classList.remove('sps-pan-ready');
    finish();
  });

  const startPan = (e: PointerEvent): void => {
    mode = 'pan';
    panStart = { x: e.clientX, y: e.clientY, vx: store.state.viewBox.x, vy: store.state.viewBox.y };
    svg.classList.add('sps-panning');
    svg.setPointerCapture(e.pointerId);
  };

  svg.addEventListener('pointerdown', (e) => {
    const state = store.state;
    const target = e.target as Element;
    if (mode !== 'idle') return;
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    svg.focus({ preventScroll: true });
    if (e.button === 1 || spaceHeld) {
      startPan(e);
      return;
    }

    // Insertion placement: any click on canvas places the pending command.
    if (state.insertion) {
      const pt = renderer.toCanvas(e.clientX, e.clientY);
      placeInsertion(store, renderer, state.insertion.type, pt.x, pt.y, e.ctrlKey);
      return;
    }

    const cmdId = target.getAttribute?.('data-sps-cmd');
    if (cmdId) {
      const cmd = state.path.commands.find((c) => String(c.id) === cmdId);
      if (cmd) {
        store.beginGesture();
        moved = false;
        if (target.getAttribute('data-sps') === 'handle-control') {
          mode = 'drag-control';
          dragCi = Number(target.getAttribute('data-sps-ci') ?? 0);
        } else {
          mode = 'drag-end';
        }
        dragCmd = cmd;
        store.update((s) => {
          s.selection = cmd;
        });
        svg.setPointerCapture(e.pointerId);
        return;
      }
    }

    // double-click handled separately; plain background = pan
    startPan(e);
  });

  svg.addEventListener('pointermove', (e) => {
    if (mode === 'idle') return;
    if (mode === 'pan' && panStart) {
      const { sx, sy } = renderer.scaleTo(store.state);
      const dx = (e.clientX - panStart.x) / sx;
      const dy = (e.clientY - panStart.y) / sy;
      store.update((s) => {
        s.viewBox.x = panStart!.vx - dx;
        s.viewBox.y = panStart!.vy - dy;
      });
      return;
    }

    if ((mode === 'drag-end' || mode === 'drag-control') && dragCmd) {
      moved = true;
      const pt = renderer.toCanvas(e.clientX, e.clientY);
      const snapped = store.state.settings.snap && !e.ctrlKey ? snapPoint(renderer, pt) : pt;
      store.update((s) => {
        const cmd = s.drag?.cmd ?? dragCmd!;
        const isRel = cmd.relative;
        if (mode === 'drag-end') {
          if (cmd.type === 'H') {
            cmd.values[0] = isRel ? snapped.x - cmd.absStart.x : snapped.x;
          } else if (cmd.type === 'V') {
            cmd.values[0] = isRel ? snapped.y - cmd.absStart.y : snapped.y;
          } else {
            const x = isRel ? snapped.x - cmd.absStart.x : snapped.x;
            const y = isRel ? snapped.y - cmd.absStart.y : snapped.y;
            const arity = cmd.values.length;
            if (arity <= 2) {
              cmd.values[arity - 2] = x;
              cmd.values[arity - 1] = y;
            } else if (cmd.type === 'A') {
              cmd.values[3] = x;
              cmd.values[4] = y;
            } else {
              // C/S/Q: last two values are the endpoint
              cmd.values[arity - 2] = x;
              cmd.values[arity - 1] = y;
            }
          }
        } else {
          // control point drag
          const x = isRel ? snapped.x - cmd.absStart.x : snapped.x;
          const y = isRel ? snapped.y - cmd.absStart.y : snapped.y;
          if (cmd.type === 'C') {
            if (dragCi === 0) {
              cmd.values[0] = x;
              cmd.values[1] = y;
            } else {
              cmd.values[2] = x;
              cmd.values[3] = y;
            }
          } else if (cmd.type === 'S') {
            cmd.values[0] = x;
            cmd.values[1] = y;
          } else if (cmd.type === 'Q') {
            cmd.values[0] = x;
            cmd.values[1] = y;
          }
        }
        // keep live drag reference
        s.drag = { cmd, kind: mode === 'drag-end' ? 'end' : 'control', controlIndex: dragCi };
        s.path.refreshAbsolutePositions();
      });
    }
  });

  const finish = (): void => {
    if (mode === 'drag-end' || mode === 'drag-control') {
      if (moved) {
        store.update((s) => {
          s.drag = null;
        });
        store.endGesture();
      } else {
        // simple click on an existing handle → context menu after click?
        store.endGesture();
      }
      dragCmd = null;
    }
    mode = 'idle';
    panStart = null;
    svg.classList.remove('sps-panning');
  };

  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);
  svg.addEventListener('lostpointercapture', finish);

  svg.addEventListener('dblclick', (e) => {
    const target = e.target as Element;
    const cmdId = target.getAttribute?.('data-sps-cmd');
    if (cmdId) {
      const cmd = store.state.path.commands.find((c) => String(c.id) === cmdId);
      if (cmd) {
        openCommandMenu(store, renderer, cmd, e.clientX, e.clientY);
      }
    }
  });

  svg.addEventListener('contextmenu', (e) => {
    const target = e.target as Element;
    const cmdId = target.getAttribute?.('data-sps-cmd');
    const cmd = cmdId
      ? store.state.path.commands.find((c) => String(c.id) === cmdId)
      : store.state.selection;
    if (!cmd || store.state.settings.preview) return;
    e.preventDefault();
    openCommandMenu(store, renderer, cmd, e.clientX, e.clientY);
  });

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (!e.deltaY || mode !== 'idle') return;
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? svg.clientHeight : 1);
      const fine = e.ctrlKey ? 0.25 : 1;
      const factor = Math.exp(Math.max(-0.35, Math.min(0.35, delta * 0.002 * fine)));
      zoomAt(renderer, store, e.clientX, e.clientY, factor);
    },
    { passive: false }
  );
}

/** Snap a canvas point to the current grid. */
export function snapPoint(renderer: Renderer, pt: { x: number; y: number }): { x: number; y: number } {
  const step = renderer.gridStep();
  return { x: Math.round(pt.x / step) * step, y: Math.round(pt.y / step) * step };
}

export function zoomAt(renderer: Renderer, store: Store, clientX: number, clientY: number, factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0) return;
  const largest = Math.max(store.state.viewBox.width, store.state.viewBox.height);
  const next = Math.min(1e6, Math.max(0.01, largest * factor));
  factor = next / largest;
  const before = renderer.toCanvas(clientX, clientY);
  store.update((s) => {
    s.viewBox.width *= factor;
    s.viewBox.height *= factor;
    const after = renderer.toCanvas(clientX, clientY);
    s.viewBox.x += before.x - after.x;
    s.viewBox.y += before.y - after.y;
  });
}

/** Place a pending insertion command at a canvas point. */
function placeInsertion(store: Store, renderer: Renderer, type: NonNullable<Store['state']['insertion']>['type'], x: number, y: number, bypassSnap: boolean): void {
  if (!type) return;
  store.beginGesture();
  const state = store.state;

  let pt = { x, y };
  if (state.settings.snap && !bypassSnap) pt = snapPoint(renderer, pt);

  const selected = state.selection;
  const selIndex = selected ? state.path.commands.indexOf(selected) : state.path.commands.length - 1;
  const anchor = state.path.commands[Math.max(0, selIndex)]!;

  // For V/H only one coordinate is meaningful; use the delta from anchor.
  let cmd: SpsCommand;
  switch (type) {
    case 'M':
      cmd = SpsCommand.make('M', false, [pt.x, pt.y]);
      break;
    case 'L':
    case 'T':
      cmd = SpsCommand.make(type, false, [pt.x, pt.y]);
      break;
    case 'H':
      cmd = SpsCommand.make('H', false, [pt.x]);
      break;
    case 'V':
      cmd = SpsCommand.make('V', false, [pt.y]);
      break;
    case 'C':
      cmd = SpsCommand.make('C', false, [pt.x - 2, pt.y - 2, pt.x - 1, pt.y - 1, pt.x, pt.y]);
      break;
    case 'S':
    case 'Q':
      cmd = SpsCommand.make(type, false, [pt.x - 1, pt.y - 1, pt.x, pt.y]);
      break;
    case 'A': {
      const r = Math.max(1, Math.abs(pt.x - anchor.absEnd.x) || 1);
      cmd = SpsCommand.make('A', false, [r, r, 0, pt.x, pt.y]);
      cmd.sweep = true;
      break;
    }
    default:
      return;
  }

  store.update((s) => {
    s.path.insert(cmd, anchor);
    s.selection = cmd;
    s.insertion = null;
    s.path.refreshAbsolutePositions();
  });
  store.endGesture();
}
