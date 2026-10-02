import { changePathOrigin } from '@svg-path-studio/core';
import type { SpsCommand, Point } from '@svg-path-studio/core';

/** Rewrite a command's values from absolute to relative (keeping geometry). */
export function rewriteRelative(cmd: SpsCommand, S: Point): void {
  if (cmd.type === 'Z' || cmd.relative) return;
  cmd.values = cmd.values.map((v, i) => {
    if (cmd.type === 'H') return v - S.x;
    if (cmd.type === 'V') return v - S.y;
    if (cmd.type === 'A') return i === 3 ? v - S.x : i === 4 ? v - S.y : v;
    return i % 2 === 0 ? v - S.x : v - S.y;
  });
  cmd.relative = true;
}

/** Rewrite a command's values from relative to absolute (keeping geometry). */
export function rewriteAbsolute(cmd: SpsCommand, S: Point): void {
  if (cmd.type === 'Z' || !cmd.relative) return;
  cmd.values = cmd.values.map((v, i) => {
    if (cmd.type === 'H') return v + S.x;
    if (cmd.type === 'V') return v + S.y;
    if (cmd.type === 'A') return i === 3 ? v + S.x : i === 4 ? v + S.y : v;
    return i % 2 === 0 ? v + S.x : v + S.y;
  });
  cmd.relative = false;
}

/**
 * Rotate the command list so that the command at `index` becomes the first
 * drawn segment of its subpath. For the whole path, move that subpath first.
 */
export function rotatePathOrigin(s: { path: import('@svg-path-studio/core').SpsPath; selection: SpsCommand | null }, index: number, subpathOnly: boolean): void {
  if (!s.path.commands[index] || s.path.commands[index].type === 'Z') return;
  // Materialize relative coordinates before reordering segments/subpaths.
  s.path.setRelative(false);
  // Shorthand controls must remain explicit when their predecessor changes.
  for (const cmd of [...s.path.commands]) {
    if (cmd.type === 'S' || cmd.type === 'T') s.path.changeType(cmd, cmd.type === 'S' ? 'C' : 'Q');
  }
  let start = index;
  while (start > 0 && s.path.commands[start].type !== 'M') start--;
  changePathOrigin(s.path, index);
  if (!subpathOnly && start > 0) {
    let end = start + 1;
    while (end < s.path.commands.length && s.path.commands[end].type !== 'M') end++;
    const subpath = s.path.commands.splice(start, end - start);
    s.path.commands.unshift(...subpath);
    start = 0;
  }
  s.path.refreshAbsolutePositions();
  s.selection = s.path.commands[start] ?? null;
}
