/** Context menu system: command row/canvas "..." menu with submenus. */

import type { Store } from '../state/store.js';
import type { Renderer } from '../render/renderer.js';
import { SpsCommand, reverseSubpath } from '@svg-path-studio/core';
import type { CommandType } from '@svg-path-studio/core';
import { icon } from './icons.js';
import { rewriteRelative, rewriteAbsolute, rotatePathOrigin } from './pathHelpers.js';

const INSERT_ORDER: CommandType[] = ['M', 'L', 'V', 'H', 'C', 'S', 'Q', 'T', 'A', 'Z'];
const INSERT_LABELS: Record<CommandType, string> = {
  M: 'Move to',
  L: 'Line to',
  V: 'Vertical Line to',
  H: 'Horizontal Line to',
  C: 'Curve to',
  S: 'Shorthand Curve to',
  Q: 'Quadratic Bézier Curve to',
  T: 'Shorthand Quadratic Bézier Curve to',
  A: 'Elliptical Arc',
  Z: 'Close Path'
};



let openMenu: HTMLElement | null = null;
let openSubmenu: HTMLElement | null = null;
let submenuTrigger: HTMLButtonElement | null = null;
let unsubscribe: (() => void) | null = null;
let focusReturn: HTMLElement | null = null;

function closeSubmenu(): void {
  openSubmenu?.remove();
  openSubmenu = null;
  submenuTrigger?.setAttribute('aria-expanded', 'false');
  submenuTrigger?.classList.remove('sps-menu-active');
  submenuTrigger = null;
}

export function closeMenu(): void {
  closeSubmenu();
  openMenu?.remove();
  openMenu = null;
  unsubscribe?.();
  unsubscribe = null;
  document.removeEventListener('pointerdown', onDocDown, true);
  document.removeEventListener('keydown', onEsc, true);
  document.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', closeMenu);
}

function onDocDown(e: PointerEvent): void {
  if (openMenu && !openMenu.contains(e.target as Node)) closeMenu();
}

function onScroll(e: Event): void {
  if (e.target instanceof Node && openMenu?.contains(e.target)) {
    if (e.target === openMenu) closeSubmenu();
    return;
  }
  closeMenu();
}

function onEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape' && openMenu) {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    if (focusReturn?.isConnected) focusReturn.focus();
  } else if (e.key === 'Tab') closeMenu();
}

function menuItem(label: string, iconSvg: string, disabled: boolean, onClick: () => void, subArrow = false): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'sps-menu-item';
  btn.type = 'button';
  btn.setAttribute('role', 'menuitem');
  btn.tabIndex = -1;
  btn.innerHTML = `${iconSvg}<span>${label}</span>${subArrow ? `<span class="sps-sub-arrow">${icon('chevron')}</span>` : ''}`;
  btn.disabled = disabled;
  if (!disabled) btn.addEventListener('click', onClick);
  return btn;
}

function menuSep(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'sps-menu-sep';
  return div;
}

function buildInsertSubmenu(store: Store, cmd: SpsCommand): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'sps-menu';
  // S invalid without preceding C/S; T invalid without preceding Q/T.
  // The selected command precedes an insertion AFTER it.
  const prevIsCurve = cmd.type === 'C' || cmd.type === 'S';
  const prevIsQuad = cmd.type === 'Q' || cmd.type === 'T';

  for (const t of INSERT_ORDER) {
    let disabled = false;
    if (t === 'S' && !prevIsCurve) disabled = true;
    if (t === 'T' && !prevIsQuad) disabled = true;
    menu.appendChild(
      menuItem(INSERT_LABELS[t], `<b class="sps-menu-command">${t}</b>`, disabled, () => {
        closeMenu();
        if (t === 'Z') {
          store.beginGesture();
          store.update((s) => {
            const closing = SpsCommand.make('Z', false, []);
            s.path.insert(closing, cmd);
            s.selection = closing;
            s.insertion = null;
          });
          store.endGesture();
          return;
        }
        store.update((s) => {
          s.insertion = { type: t };
          s.selection = cmd;
        });
      })
    );
  }
  return menu;
}

function buildConvertSubmenu(store: Store, cmd: SpsCommand): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'sps-menu';
  const state = store.state;
  const idx = state.path.commands.indexOf(cmd);
  const prev = state.path.commands[idx - 1];
  const prevIsQuad = prev && (prev.type === 'Q' || prev.type === 'T');
  const prevIsCurve = prev && (prev.type === 'C' || prev.type === 'S');

  const targets: { t: CommandType; valid: boolean }[] = [
    { t: 'M', valid: !(cmd.type === 'M' && idx === 0) },
    { t: 'L', valid: true },
    { t: 'V', valid: true },
    { t: 'H', valid: true },
    { t: 'C', valid: true },
    { t: 'S', valid: !!prevIsCurve },
    { t: 'Q', valid: true },
    { t: 'T', valid: !!prevIsQuad },
    { t: 'A', valid: true },
    { t: 'Z', valid: true }
  ];

  for (const { t, valid } of targets) {
    menu.appendChild(
      menuItem(INSERT_LABELS[t], `<b class="sps-menu-command">${t}</b>`, !valid || t === cmd.type, () => {
        closeMenu();
        store.beginGesture();
        store.update((s) => {
          try {
            // The engine expects absolute source geometry during conversion.
            const relative = cmd.relative;
            rewriteAbsolute(cmd, cmd.absStart);
            s.path.changeType(cmd, t);
            const converted = s.path.commands[idx];
            if (relative && converted) rewriteRelative(converted, converted.absStart);
            s.selection = converted ?? null;
          } catch {
            /* invalid conversion ignored */
          }
          s.path.refreshAbsolutePositions();
        });
        store.endGesture();
      })
    );
  }
  return menu;
}

function prepareMenu(menu: HTMLElement, label: string): void {
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', label);
  menu.addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.closest('[role="menu"]') !== menu) return;
    e.stopPropagation();
    const items = [...menu.querySelectorAll<HTMLButtonElement>(':scope > .sps-menu-item:not(:disabled)')];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const index = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
        : (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[index]?.focus();
    } else if (e.key === 'ArrowLeft' && menu === openSubmenu) {
      e.preventDefault();
      const trigger = submenuTrigger;
      closeSubmenu();
      trigger?.focus();
    }
  });
}

function attachSubmenu(menu: HTMLElement, trigger: HTMLButtonElement, build: () => HTMLElement): void {
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  const show = (focus = false): void => {
    if (submenuTrigger !== trigger) {
      closeSubmenu();
      const sub = build();
      sub.classList.add('sps-submenu');
      prepareMenu(sub, trigger.textContent?.trim() ?? 'Commands');
      menu.appendChild(sub);
      const parent = menu.getBoundingClientRect();
      const row = trigger.getBoundingClientRect();
      const size = sub.getBoundingClientRect();
      const right = parent.right - 1;
      const left = right + size.width <= window.innerWidth - 8 ? right : parent.left - size.width + 1;
      sub.style.left = `${Math.max(8, Math.min(left, window.innerWidth - size.width - 8))}px`;
      sub.style.top = `${Math.max(8, Math.min(row.top - 5, window.innerHeight - size.height - 8))}px`;
      openSubmenu = sub;
      submenuTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('sps-menu-active');
    }
    if (focus) openSubmenu?.querySelector<HTMLButtonElement>('.sps-menu-item:not(:disabled)')?.focus();
  };
  trigger.addEventListener('pointerenter', () => show());
  trigger.addEventListener('click', () => show(true));
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      show(true);
    }
  });
}

function position(menu: HTMLElement, x: number, y: number): HTMLElement {
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
  openMenu = menu;
  document.addEventListener('pointerdown', onDocDown, true);
  document.addEventListener('keydown', onEsc, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', closeMenu);
  return menu;
}

/** Open the full command context menu for `cmd`. */
export function openCommandMenu(store: Store, _renderer: Renderer, cmd: SpsCommand, x: number, y: number): void {
  closeMenu();
  if (!store.state.path.commands.includes(cmd)) return;
  focusReturn = document.activeElement as HTMLElement | null;
  store.update((s) => {
    s.selection = cmd;
    s.insertion = null;
  });
  const state = store.state;
  const menu = document.createElement('div');
  menu.className = 'sps-menu';
  prepareMenu(menu, 'Command actions');

  const idx = state.path.commands.indexOf(cmd);
  const isFirstCmd = idx === 0;
  const insert = menuItem('Insert After', icon('plus'), false, () => {}, true);
  const convert = menuItem('Convert To', icon('convert'), isFirstCmd, () => {}, true);
  menu.append(insert, convert);
  attachSubmenu(menu, insert, () => buildInsertSubmenu(store, cmd));
  if (!convert.disabled) attachSubmenu(menu, convert, () => buildConvertSubmenu(store, cmd));

  const setRel = !cmd.relative;
  menu.appendChild(
    menuItem(setRel ? 'Set Relative' : 'Set Absolute', icon('convert'), cmd.type === 'Z', () => {
      closeMenu();
      store.beginGesture();
      store.update((s) => {
        // convert this command's values to the target mode
        const target = setRel;
        const S = cmd.absStart;
        if (target && !cmd.relative) {
          rewriteRelative(cmd, S);
        } else if (!target && cmd.relative) {
          rewriteAbsolute(cmd, S);
        }
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    })
  );

  menu.appendChild(menuSep());

  const canStartPath = !isFirstCmd && cmd.type !== 'Z';
  menu.appendChild(
    menuItem('Start Path From Here', icon('startPath'), !canStartPath, () => {
      closeMenu();
      store.beginGesture();
      store.update((s) => {
        rotatePathOrigin(s, idx, false);
      });
      store.endGesture();
    })
  );
  menu.appendChild(
    menuItem('Start Subpath From Here', icon('startPath'), !canStartPath || cmd.type === 'M', () => {
      closeMenu();
      store.beginGesture();
      store.update((s) => {
        rotatePathOrigin(s, idx, true);
      });
      store.endGesture();
    })
  );
  menu.appendChild(
    menuItem('Reverse Subpath', icon('reverse'), false, () => {
      closeMenu();
      store.beginGesture();
      store.update((s) => {
        reverseSubpath(s.path, cmd);
        s.path.refreshAbsolutePositions();
        s.selection = null;
      });
      store.endGesture();
    })
  );

  menu.appendChild(menuSep());
  menu.appendChild(
    menuItem('Delete', icon('delete'), isFirstCmd, () => {
      closeMenu();
      store.beginGesture();
      store.update((s) => {
        try {
          s.path.delete(cmd);
        } catch {
          /* initial M cannot be deleted */
        }
        if (s.selection === cmd) s.selection = null;
        s.path.refreshAbsolutePositions();
      });
      store.endGesture();
    })
  );

  for (const item of menu.querySelectorAll<HTMLButtonElement>(':scope > .sps-menu-item')) {
    const leaveSubmenu = (): void => { if (item !== submenuTrigger) closeSubmenu(); };
    item.addEventListener('pointerenter', leaveSubmenu);
    item.addEventListener('focus', leaveSubmenu);
  }

  position(menu, x, y);
  unsubscribe = store.subscribe(() => closeMenu());
  menu.querySelector<HTMLButtonElement>('.sps-menu-item:not(:disabled)')?.focus({ preventScroll: true });
}
