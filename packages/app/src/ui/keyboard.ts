/** Keyboard shortcuts (parity with the reference behavior). */

import type { Store } from '../state/store.js';
import type { CommandType } from '@svg-path-studio/core';

const INSERT_KEYS: Record<string, CommandType> = {
  m: 'M', l: 'L', v: 'V', h: 'H', c: 'C', s: 'S', q: 'Q', t: 'T', a: 'A', z: 'Z'
};

export function attachKeyboard(store: Store, openInsertMenu: () => void): void {
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    // Don't hijack typing in inputs.
    if (target.closest('input, textarea, [contenteditable]')) return;

    const state = store.state;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }

    if (mod) return; // let browser shortcuts pass

    if (e.key === 'Escape') {
      if (state.insertion) {
        store.update((s) => {
          s.insertion = null;
        });
      } else if (state.drag) {
        // undo the in-flight drag: rollback via undo stack (gesture not ended)
        store.update((s) => {
          s.drag = null;
        });
      }
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection) {
      e.preventDefault();
      store.beginGesture();
      store.update((s) => {
        try {
          s.path.delete(s.selection!);
        } catch {
          /* first M cannot be deleted */
        }
        s.selection = null;
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
      return;
    }

    const letter = e.key.toLowerCase();
    if (INSERT_KEYS[letter] && !mod) {
      e.preventDefault();
      const type = INSERT_KEYS[letter]!;
      if (e.shiftKey) {
        // convert selected command to type
        if (state.selection) {
          store.beginGesture();
          store.update((s) => {
            try {
              s.path.changeType(s.selection!, type);
              s.path.refreshAbsolutePositions();
            } catch {
              /* invalid conversion */
            }
          });
          store.endGesture();
        }
      } else {
        // begin insertion of that type after selection
        store.update((s) => {
          if (type !== 'Z') s.insertion = { type };
          s.selection = s.selection ?? s.path.commands[s.path.commands.length - 1] ?? null;
        });
        openInsertMenu();
      }
    }
  });
}
