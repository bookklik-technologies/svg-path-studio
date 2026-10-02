import { SpsCommand } from './command.js';
import { SpsPath } from './path.js';

/**
 * Change the origin of a subpath: the path (or subpath) is redrawn starting
 * FROM the end point of the command at `index`.
 *
 * - Closed subpaths keep their exact shape: the former closing edge (Z) is
   made explicit as the first drawn segment, and Z closes the loop at the end.
 * - Open subpaths connect commands in the rotated order (the shape changes,
 *   which is inherent to re-originating an open path).
 */
export function changePathOrigin(p: SpsPath, index: number): void {
  p.refreshAbsolutePositions();

  // Find the subpath [start, end) containing `index`.
  let start = 0;
  for (let i = index; i >= 0; i--) {
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
  if (index <= start || index >= end) return; // nothing to rotate

  const m = p.commands[start]!;
  const p0 = { ...m.absEnd }; // subpath start point
  const body = p.commands.slice(start + 1, end); // segments S1..Sn (maybe trailing Z)
  const hadClose = body[body.length - 1]!.type === 'Z';
  const segs = hadClose ? body.slice(0, -1) : body;

  const k = index - start - 1; // 0-based index of the selected segment
  const selected = segs[k]!;
  const pk = { ...selected.absEnd }; // new origin
  const pn = { ...segs[segs.length - 1]!.absEnd }; // last segment's end

  // A single-segment OPEN subpath cannot be re-originated (drawing "from its
  // own end" collapses the segment); treat as no-op. Closed subpaths still
  // work because the closing edge becomes an explicit segment.
  if (!hadClose && segs.length < 2) return;

  const after = segs.slice(k + 1); // Sk+1..Sn
  const before = segs.slice(0, k + 1); // S1..Sk

  const rebuilt: SpsCommand[] = [SpsCommand.make('M', false, [pk.x, pk.y])];

  if (hadClose) {
    rebuilt.push(...after);
    // The old closing edge becomes an explicit line pn → p0.
    if (Math.abs(pn.x - p0.x) > 1e-9 || Math.abs(pn.y - p0.y) > 1e-9) {
      rebuilt.push(SpsCommand.make('L', false, [p0.x, p0.y]));
    }
    rebuilt.push(...before);
    rebuilt.push(SpsCommand.make('Z', false, []));
  } else {
    rebuilt.push(...after);
    if (before.length > 0) {
      // Connect the tail to the head. If both exist, S1 now starts at pn.
      // If the rotation is degenerate (S1 is the ONLY segment, i.e. selecting
      // the first segment is a no-op — guarded by k===0 && after empty means
      // nothing to do), S1 keeps its original start.
      if (after.length > 0) {
        rebuilt.push(shiftStart(before[0]!, pn));
      } else {
        rebuilt.push(keepGeometry(before[0]!, p0));
      }
      rebuilt.push(...before.slice(1));
    }
  }

  p.commands.splice(start, end - start, ...rebuilt);
  p.refreshAbsolutePositions();
}

/** Re-anchor a command at its ORIGINAL start (used when rotation is degenerate). */
function keepGeometry(old: SpsCommand, originalStart: { x: number; y: number }): SpsCommand {
  return shiftStart(old, originalStart);
}

/** Rebuild command `old` so it starts at `newStart` instead of its cached
 * start, keeping its end point and type. Control points translate with the
 * start (their offsets relative to the start are preserved). */
function shiftStart(old: SpsCommand, newStart: { x: number; y: number }): SpsCommand {
  const end = old.absEnd;
  const dx = newStart.x - old.absStart.x;
  const dy = newStart.y - old.absStart.y;

  switch (old.type) {
    case 'L':
    case 'H':
    case 'V':
    case 'M':
      return SpsCommand.make('L', false, [end.x, end.y]);
    case 'C': {
      const c1 = old.absControls[0]!;
      const c2 = old.absControls[1]!;
      return SpsCommand.make('C', false, [c1.x + dx, c1.y + dy, c2.x + dx, c2.y + dy, end.x, end.y]);
    }
    case 'Q': {
      const cp = old.absControls[0]!;
      return SpsCommand.make('Q', false, [cp.x + dx, cp.y + dy, end.x, end.y]);
    }
    case 'A': {
      const [rx, ry, rot] = [old.values[0]!, old.values[1]!, old.values[2]!];
      const cmd = SpsCommand.make('A', false, [rx, ry, rot, end.x, end.y]);
      cmd.largeArc = old.largeArc;
      cmd.sweep = old.sweep;
      return cmd;
    }
    case 'Z':
      return SpsCommand.make('Z', false, []);
  }
  // Exhaustive over CommandType; defensive fallthrough:
  return SpsCommand.make('L', false, [old.absEnd.x, old.absEnd.y]);
}
