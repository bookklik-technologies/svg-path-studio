import { SpsCommand } from './command.js';
import { SpsPath } from './path.js';

/**
 * Reversal of a path or a single subpath.
 *
 * Geometry preservation rules:
 * - Each subpath's commands run in the opposite direction.
 * - Every curve's control points swap order (cp1↔cp2, etc.).
 * - The path's overall start point changes to the former subpath end.
 * - A trailing Z (closed subpath) stays a trailing Z after reversal.
 */

export function reversePath(p: SpsPath): void {
  // Split into subpaths (each starts at an M command).
  const subpathIdx: number[] = [];
  p.commands.forEach((c, i) => {
    if (c.type === 'M') subpathIdx.push(i);
  });
  // Reverse each subpath independently, then rebuild.
  for (let k = subpathIdx.length - 1; k >= 0; k--) {
    reverseSubpathRange(p, subpathIdx[k]!, k + 1 < subpathIdx.length ? subpathIdx[k + 1]! : p.commands.length);
  }
  p.refreshAbsolutePositions();
}

export function reverseSubpath(p: SpsPath, cmd: SpsCommand): void {
  const idx = p.commands.indexOf(cmd);
  if (idx === -1) throw new Error('command not in path');

  // Find the subpath containing idx.
  let start = 0;
  for (let i = idx; i >= 0; i--) {
    if (p.commands[i]!.type === 'M') {
      start = i;
      break;
    }
  }
  let end = p.commands.length;
  for (let i = start + 1; i < p.commands.length; i++) {
    if (p.commands[i]!.type === 'M') {
      end = i;
      break;
    }
  }

  reverseSubpathRange(p, start, end);
  p.refreshAbsolutePositions();
}

/**
 * Reverse commands[start..end) as one subpath.
 *
 * The M command's role is taken by the old end point: the new first command is
 * an M to the old end position, and each subsequent command is the old command
 * before it with swapped control points. A trailing Z converts the closing
 * line back into Z; an open subpath's final segment (back to the old start)
 * becomes an explicit line/curve to the old start point.
 */
function reverseSubpathRange(p: SpsPath, start: number, end: number): void {
  const seg = p.commands.slice(start, end);
  const hadClose = seg[seg.length - 1]?.type === 'Z';
  const body = hadClose ? seg.slice(0, -1) : seg;

  // The new subpath starts at the old endpoint (last body command's end).
  const lastPt = { ...body[body.length - 1]!.absEnd };

  const rebuilt: SpsCommand[] = [];

  // New M to the old endpoint.
  rebuilt.push(SpsCommand.make('M', false, [lastPt.x, lastPt.y]));

  // Walk the old body backwards; each old command's end becomes the new
  // command's start, and its controls are reused with order preserved
  // (because reversing direction mirrors the whole segment).
  for (let i = body.length - 1; i >= 1; i--) {
    const old = body[i]!;
    const startPt = old.absStart;
    const endPt = old.absEnd;

    switch (old.type) {
      case 'L':
      case 'H':
      case 'V':
        rebuilt.push(SpsCommand.make('L', false, [startPt.x, startPt.y]));
        break;
      case 'C':
        rebuilt.push(SpsCommand.make('C', false, [old.absControls[1]!.x, old.absControls[1]!.y, old.absControls[0]!.x, old.absControls[0]!.y, startPt.x, startPt.y]));
        break;
      case 'S': {
        // S implied cp1 = reflection; reconstruct explicit C on reverse.
        const impliedCp1 = old.absControls[0]!;
        rebuilt.push(SpsCommand.make('C', false, [old.absControls[1]!.x, old.absControls[1]!.y, impliedCp1.x, impliedCp1.y, startPt.x, startPt.y]));
        break;
      }
      case 'Q':
        rebuilt.push(SpsCommand.make('Q', false, [old.absControls[0]!.x, old.absControls[0]!.y, startPt.x, startPt.y]));
        break;
      case 'T': {
        const cp = old.absControls[0]!;
        rebuilt.push(SpsCommand.make('Q', false, [cp.x, cp.y, startPt.x, startPt.y]));
        break;
      }
      case 'A':
        rebuilt.push(makeReversedArc(old, startPt));
        break;
      case 'M':
      case 'Z':
        // handled above / not present in body range
        break;
    }
    void endPt;
  }

  // If the subpath was open, we're done (last rebuilt command ends at old start).
  // If it was closed, append Z.
  if (hadClose) rebuilt.push(SpsCommand.make('Z', false, []));

  p.commands.splice(start, end - start, ...rebuilt);
}

/** Reverse an A command: swap endpoints, flip sweep flag, keep radii/rotation. */
function makeReversedArc(old: SpsCommand, newEnd: { x: number; y: number }): SpsCommand {
  const [rx, ry, rot] = [old.values[0]!, old.values[1]!, old.values[2]!];
  const cmd = SpsCommand.make('A', false, [rx, ry, rot, newEnd.x, newEnd.y]);
  cmd.largeArc = old.largeArc;
  cmd.sweep = !old.sweep;
  return cmd;
}
