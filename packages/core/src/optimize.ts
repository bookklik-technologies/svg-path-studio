import { SpsCommand } from './command.js';
import { SpsPath } from './path.js';
import { OptimizeOptions, Point } from './types.js';

/**
 * Path optimizer with seven independent, default-off flags.
 * Deterministic; single pass per flag, applied in fixed order.
 */

export function optimizePath(p: SpsPath, opts: OptimizeOptions = {}): void {
  const o: Required<OptimizeOptions> = {
    removeUselessCommands: false,
    useShorthands: false,
    useHorizontalAndVerticalLines: false,
    useRelativeAbsolute: false,
    useReverse: false,
    removeOrphanDots: false,
    useClosePath: false,
    ...opts
  };

  p.refreshAbsolutePositions();

  if (o.removeUselessCommands) removeUseless(p);
  if (o.useShorthands) promoteShorthands(p);
  if (o.useHorizontalAndVerticalLines) straightenToHV(p);
  if (o.useRelativeAbsolute) chooseShortestRelAbs(p);
  if (o.removeOrphanDots) removeOrphanDots(p);
  if (o.useClosePath) closeToZ(p);
  if (o.useReverse) reverseIfShorter(p);

  p.refreshAbsolutePositions();
}

/** Zero-length segments and M→M duplicates (the LATER M wins). */
function removeUseless(p: SpsPath): void {
  const keep: SpsCommand[] = [];
  for (let i = 0; i < p.commands.length; i++) {
    const cmd = p.commands[i]!;
    if (cmd.type === 'M' && keep.length > 0 && keep[keep.length - 1]!.type === 'M') {
      keep[keep.length - 1] = cmd; // replace previous M with the later one
      continue;
    }
    if (cmd.type !== 'M' && cmd.type !== 'Z') {
      const s = cmd.absStart;
      const e = cmd.absEnd;
      const isZeroLength =
        Math.abs(s.x - e.x) < 1e-9 &&
        Math.abs(s.y - e.y) < 1e-9 &&
        // degenerate only if controls are also flat (C with all points equal)
        cmd.absControls.every((c) => Math.abs(c.x - s.x) < 1e-9 && Math.abs(c.y - s.y) < 1e-9);
      if (isZeroLength && cmd.type === 'L') continue;
    }
    keep.push(cmd);
  }
  // The path must always start with M.
  if (keep.length > 0 && keep[0]!.type !== 'M') {
    const first = keep[0]!;
    keep.unshift(SpsCommand.make('M', false, [first.absStart.x, first.absStart.y]));
  }
  p.commands = keep;
}

/** C→S and Q→T when the current first control is the exact reflection. */
function promoteShorthands(p: SpsPath): void {
  for (let i = 1; i < p.commands.length; i++) {
    const cmd = p.commands[i]!;
    const prev = p.commands[i - 1]!;
    if (cmd.type === 'C' && (prev.type === 'C' || prev.type === 'S')) {
      const implied = reflectPt(prev.absControls[prev.absControls.length - 1]!, cmd.absStart);
      const cp1 = cmd.absControls[0]!;
      if (Math.abs(implied.x - cp1.x) < 1e-6 && Math.abs(implied.y - cp1.y) < 1e-6) {
        const c2 = cmd.absControls[1]!;
        const s = SpsCommand.make('S', cmd.relative, [c2.x - (cmd.relative ? cmd.absStart.x : 0), c2.y - (cmd.relative ? cmd.absStart.y : 0), cmd.values[4]! - (cmd.relative ? cmd.absStart.x : 0), cmd.values[5]! - (cmd.relative ? cmd.absStart.y : 0)]);
        p.commands[i] = s;
      }
    } else if (cmd.type === 'Q' && (prev.type === 'Q' || prev.type === 'T')) {
      const implied = reflectPt(prev.absControls[0]!, cmd.absStart);
      const cp = cmd.absControls[0]!;
      if (Math.abs(implied.x - cp.x) < 1e-6 && Math.abs(implied.y - cp.y) < 1e-6) {
        const ex = cmd.values[2]! - (cmd.relative ? cmd.absStart.x : 0);
        const ey = cmd.values[3]! - (cmd.relative ? cmd.absStart.y : 0);
        p.commands[i] = SpsCommand.make('T', cmd.relative, [ex, ey]);
      }
    }
  }
}

/** L with equal y → H; equal x → V (absolute values written relative to current). */
function straightenToHV(p: SpsPath): void {
  for (let i = 0; i < p.commands.length; i++) {
    const cmd = p.commands[i]!;
    if (cmd.type !== 'L') continue;
    const s = cmd.absStart;
    const e = cmd.absEnd;
    if (Math.abs(s.y - e.y) < 1e-9) {
      p.commands[i] = SpsCommand.make('H', cmd.relative, [e.x - (cmd.relative ? s.x : 0)]);
    } else if (Math.abs(s.x - e.x) < 1e-9) {
      p.commands[i] = SpsCommand.make('V', cmd.relative, [e.y - (cmd.relative ? s.y : 0)]);
    }
  }
}

/** Per command, pick relative-vs-absolute — whichever serializes shorter; ties keep current state. */
function chooseShortestRelAbs(p: SpsPath): void {
  p.refreshAbsolutePositions();
  for (const cmd of p.commands) {
    if (cmd.type === 'Z') continue;
    const S = cmd.absStart;
    // Rebased relative values: subtract the command's start from each absolute value.
    const relVals = cmd.values.map((v, i) => {
      if (cmd.type === 'H') return cmd.relative ? v : v - S.x;
      if (cmd.type === 'V') return cmd.relative ? v : v - S.y;
      // pairs: even index = x, odd = y
      const isX = i % 2 === 0;
      return cmd.relative ? v : isX ? v - S.x : v - S.y;
    });

    const absCost = cmd.letter.toUpperCase() + cmd.values.map((v) => trimNum(v)).join(',');
    const relLetter = cmd.relative ? cmd.letter : cmd.letter.toLowerCase();
    const relCost = relLetter + relVals.map((v) => trimNum(v)).join(',');
    if (relCost.length < absCost.length) {
      // convert to relative with rebased values
      const c = cmd.clone();
      c.relative = true;
      c.values = relVals;
      const idx = p.commands.indexOf(cmd);
      p.commands[idx] = c;
    } else if (absCost.length < relCost.length) {
      const c = cmd.clone();
      c.relative = false;
      const idx = p.commands.indexOf(cmd);
      p.commands[idx] = c;
    }
  }
}

function trimNum(v: number): string {
  const s = v.toString();
  return s;
}

/** Remove M-only subpaths that draw nothing (isolated dots). */
function removeOrphanDots(p: SpsPath): void {
  const keep: SpsCommand[] = [];
  for (let i = 0; i < p.commands.length; i++) {
    const cmd = p.commands[i]!;
    if (cmd.type === 'M') {
      // Look ahead: if the next command is an M or Z or end-of-path, this
      // subpath is an orphan dot.
      const next = p.commands[i + 1];
      if (!next || next.type === 'M' || (next.type === 'Z' && (p.commands[i + 2]?.type === 'M' || i + 2 >= p.commands.length))) {
        continue;
      }
    }
    keep.push(cmd);
  }
  p.commands = keep;
}

/** Replace trailing L-to-subpath-start with Z. */
function closeToZ(p: SpsPath): void {
  p.refreshAbsolutePositions();
  for (let i = 0; i < p.commands.length; i++) {
    const cmd = p.commands[i]!;
    if (cmd.type !== 'L') continue;
    const next = p.commands[i + 1];
    const e = cmd.absEnd;
    // Find this subpath's start point (most recent M's end).
    const sp = p.startPointOfSubpath(i);
    // "trailing": last command of a subpath (next is M/Z/end)
    const isLastOfSubpath = !next || next.type === 'M' || next.type === 'Z';
    if (isLastOfSubpath && Math.abs(sp.x - e.x) < 1e-9 && Math.abs(sp.y - e.y) < 1e-9) {
      p.commands[i] = SpsCommand.make('Z', false, []);
    }
  }
}

/** Try the reversed path; keep it if strictly shorter. */
function reverseIfShorter(p: SpsPath): void {
  const before = p.asString(4, true).length;
  const snapshot = p.asString(10, false);
  const clone = new SpsPath(snapshot);
  reversePathImpl(clone);
  const after = clone.asString(4, true).length;
  if (after < before) {
    reversePathImpl(p);
  }
}

// Imported at module scope (used only inside functions, no cycle at eval time).
import { reversePath as reversePathImpl } from './reverse.js';

function reflectPt(p: Point, anchor: Point): Point {
  return { x: 2 * anchor.x - p.x, y: 2 * anchor.y - p.y };
}
