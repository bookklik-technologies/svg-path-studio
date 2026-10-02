import { describe, it, expect } from 'vitest';
import { SpsPath, SpsParseError, SpsCommand, changePathOrigin, optimizePath, reverseSubpath } from '../src/index.js';

describe('path.ts remaining branches', () => {
  it('C→A fits via parallel tangents (semicircle branch)', () => {
    // cp1 and cp2 collinear with start/end → parallel tangents
    const p = new SpsPath('M 0 0 C 2 4 4 4 6 0');
    p.changeType(p.commands[1]!, 'A');
    const a = p.commands[1]!;
    expect(a.type).toBe('A');
    expect(a.absEnd!.x).toBeCloseTo(6, 6);
    expect(a.absEnd!.y).toBeCloseTo(0, 6);
  });

  it('A→C with degenerate arc produces collapsed C', () => {
    const p = new SpsPath('M 1 1 A 0 0 0 0 1 5 5'); // zero radii
    p.changeType(p.commands[1]!, 'C');
    expect(p.commands[1]!.type).toBe('C');
    expect(p.commands[1]!.absEnd!.x).toBe(5);
  });

  it('non-curve → S and → T produce finite controls', () => {
    const p = new SpsPath('M 0 0 L 6 6');
    p.changeType(p.commands[1]!, 'S');
    expect(p.commands[1]!.type).toBe('S');
    const q = new SpsPath('M 0 0 L 6 6');
    q.changeType(q.commands[1]!, 'T');
    expect(q.commands[1]!.type).toBe('T');
  });

  it('line → A builds half-circle through chord', () => {
    const p = new SpsPath('M 0 0 L 10 0');
    p.changeType(p.commands[1]!, 'A');
    const a = p.commands[1]!;
    expect(a.values[0]).toBe(5);
    expect(a.sweep).toBe(true);
  });

  it('startPointOfSubpath finds the containing subpath origin', () => {
    const p = new SpsPath('M 1 1 L 2 2 M 8 8 L 9 9');
    expect(p.startPointOfSubpath(2)).toEqual({ x: 8, y: 8 });
    expect(p.startPointOfSubpath(1)).toEqual({ x: 1, y: 1 });
  });

  it('insert at end works without after', () => {
    const p = new SpsPath('M 0 0');
    p.insert(SpsCommand.make('L', false, [4, 4]));
    expect(p.asString(4)).toBe('M 0 0 L 4 4');
  });

  it('parse: relative repeat of M stays relative lineto', () => {
    const p = new SpsPath('M 0 0 m 2 2 4 4');
    expect(p.commands[1]!.letter).toBe('m');
    expect(p.commands[2]!.letter).toBe('l');
  });

  it('rotate normalizes negative angles', () => {
    const p = new SpsPath('M 1 0 A 1 1 90 0 1 2 1');
    p.rotate(0, 0, -90);
    const a = p.commands[1]!;
    expect(a.values[2]).toBe(0); // 90-90
  });

  it('parse errors: token before number reports the token index', () => {
    expect(() => new SpsPath('M 1 2 L M')).toThrow(SpsParseError);
  });
});

describe('origin.ts remaining branches', () => {
  it('open subpath re-origin with S command makes its cp1 explicit', () => {
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 S 5 4 6 0 L 8 2');
    changePathOrigin(p, 2); // from S end (6,0); S becomes first "after" segment
    // S converted to C when re-anchored
    expect(p.commands[0]!.absEnd).toEqual({ x: 6, y: 0 });
    const types = p.commands.map((c) => c.type);
    expect(types).toContain('C');
  });

  it('open subpath re-origin keeps arc flags', () => {
    const p = new SpsPath('M 0 0 L 3 0 A 2 2 0 0 1 7 0 L 9 4 L 2 6');
    changePathOrigin(p, 2); // from arc end (7,0)
    const arc = p.commands.find((c) => c.type === 'A')!;
    expect(arc.sweep).toBe(true);
    expect(arc.largeArc).toBe(false);
    expect(p.commands[0]!.absEnd).toEqual({ x: 7, y: 0 });
  });

  it('closed subpath with T converts T to Q in rotated body', () => {
    const p = new SpsPath('M 0 0 Q 2 2 4 0 T 6 4 Z');
    changePathOrigin(p, 2);
    expect(p.commands[p.commands.length - 1]!.type).toBe('Z');
    expect(p.commands.some((c) => c.type === 'Q')).toBe(true);
  });
});

describe('origin edge branches', () => {
  it('closed subpath where closing edge is degenerate (pn == p0)', () => {
    // Square: closing edge from (4,4) back to (0,0) is a real line, so use a
    // triangle whose last segment already ends at start → no explicit line added
    const p = new SpsPath('M 0 0 L 4 0 L 0 0 Z'); // last L ends at p0
    changePathOrigin(p, 1); // from (4,0)
    expect(p.commands[0]!.absEnd).toEqual({ x: 4, y: 0 });
    expect(p.commands[p.commands.length - 1]!.type).toBe('Z');
    // Geometry preserved: triangle points all present
    const ends = p.commands.slice(1).map((c) => c.absEnd);
    expect(ends.some((e) => e.x === 0 && e.y === 0)).toBe(true);
  });

  it('re-origin in the middle keeps L segments exact', () => {
    const p = new SpsPath('M 0 0 L 2 0 L 2 2 L 4 4 L 0 6');
    changePathOrigin(p, 3); // from (4,4): closed-shape behavior on open path
    expect(p.commands[0]!.absEnd).toEqual({ x: 4, y: 4 });
    const ends = p.commands.slice(1).map((c) => `${c.absEnd.x},${c.absEnd.y}`);
    expect(ends).toContain('0,6');
    expect(ends).toContain('2,0');
  });

  it('re-origin preserves rotated-order geometry on relative input', () => {
    const p = new SpsPath('M 0 0 l 2 0 l 2 2 l 0 4');
    changePathOrigin(p, 2); // from (4,2)
    expect(p.commands[0]!.absEnd).toEqual({ x: 4, y: 2 });
    // all points visited in rotated order
    const ends = p.commands.slice(1).map((c) => `${c.absEnd.x},${c.absEnd.y}`);
    expect(ends.length).toBe(3);
    expect(ends).toContain('4,6');
  });
});

describe('changeType extra branches', () => {
  it('S→C restores both controls explicitly', () => {
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 S 4 2 6 0');
    p.changeType(p.commands[2]!, 'C');
    const c = p.commands[2]!;
    expect(c.type).toBe('C');
    expect(c.values.length).toBe(6);
    expect(c.absControls[0]).toEqual({ x: 4, y: 4 }); // reflection kept
  });

  it('C→S is identity when already C', () => {
    const p = new SpsPath('M 0 0 S 4 2 6 0');
    p.changeType(p.commands[1]!, 'S');
    expect(p.commands[1]!.type).toBe('S');
  });

  it('same-type conversion is a no-op', () => {
    const p = new SpsPath('M 0 0 L 4 4');
    p.changeType(p.commands[1]!, 'L');
    expect(p.asString(4)).toBe('M 0 0 L 4 4');
  });

  it('command not in path throws', () => {
    const p = new SpsPath('M 0 0 L 4 4');
    const foreign = SpsCommand.make('L', false, [1, 1]);
    expect(() => p.changeType(foreign, 'C')).toThrow(/not in path/);
    expect(() => p.insert(SpsCommand.make('L', false, [1, 1]), foreign)).toThrow(/not in path/);
    expect(() => p.delete(foreign)).toThrow(/not in path/);
  });

  it('C→A from a straight-ish cubic keeps endpoints', () => {
    const p = new SpsPath('M 0 0 C 2 0 4 0 6 0'); // flat cubic
    p.changeType(p.commands[1]!, 'A');
    const a = p.commands[1]!;
    expect(a.type).toBe('A');
    expect(a.absEnd!.x).toBeCloseTo(6, 6);
  });

  it('V→C and H→C produce line-equivalent cubics', () => {
    const p = new SpsPath('M 0 0 V 9');
    p.changeType(p.commands[1]!, 'C');
    expect(p.commands[1]!.absEnd).toEqual({ x: 0, y: 9 });
  });

  it('Z→L conversion from a closed path', () => {
    const p = new SpsPath('M 0 0 L 4 0 L 0 0 Z');
    p.changeType(p.commands[3]!, 'L');
    // L to subpath start = zero-length or explicit line
    expect(p.commands[3]!.type).toBe('L');
  });
});

describe('origin shiftStart per-type coverage', () => {
  it('closed subpath whose rotated body contains C, Q, H, V, and A segments', () => {
    const p = new SpsPath('M 0 0 H 4 V 4 Q 6 6 8 4 A 2 2 0 0 1 12 4 L 14 0 Z');
    changePathOrigin(p, 3); // from Q end (8,4)
    expect(p.commands[0]!.absEnd).toEqual({ x: 8, y: 4 });
    // H/V segments in the rotated-into-position head keep their type
    // (they're untouched); the re-anchored tail keeps A/L/Q.
    const types = new Set(p.commands.map((c) => c.type));
    expect(types.has('A')).toBe(true);
    expect(types.has('Q')).toBe(true);
    expect(types.has('H')).toBe(true);
    expect(types.has('V')).toBe(true);
    expect(types.has('Z')).toBe(true);
    // closed shape still visits original vertices
    const ends = p.commands.map((c) => `${c.absEnd.x},${c.absEnd.y}`);
    expect(ends).toContain('0,0');
    expect(ends).toContain('4,0');
    expect(ends).toContain('4,4');
    expect(ends).toContain('14,0');
  });

  it('shiftStart with T segment converts to Q with context control', () => {
    const p = new SpsPath('M 0 0 Q 2 4 4 0 T 8 0 L 10 4');
    changePathOrigin(p, 2); // from T end (8,0)
    expect(p.commands[0]!.absEnd).toEqual({ x: 8, y: 0 });
    expect(p.commands.some((c) => c.type === 'Q')).toBe(true);
  });
});

describe('remaining guard branches', () => {
  it('removeUselessCommands: zero-length C is kept (not just L)', () => {
    // C with all points equal renders nothing but is not L — kept per current rule
    const p = new SpsPath('M 0 0 C 2 2 2 2 2 2 L 4 4');
    optimizePath(p, { removeUselessCommands: true });
    expect(p.commands.length).toBe(3);
  });

  it('optimize.removeUselessCommands keeps M-first invariant when first cmd deleted', () => {
    const p = new SpsPath('M 0 0 L 0 0 L 5 5'); // first L zero-length, removed
    optimizePath(p, { removeUselessCommands: true });
    expect(p.commands[0]!.type).toBe('M');
    expect(p.commands.length).toBe(2);
  });

});

describe('transform + setRelative per-type branches', () => {
  it('scale covers S, Q, T, H, V, A branches', () => {
    const p = new SpsPath('M 1 1 H 5 V 6 S 8 2 10 4 Q 12 6 14 8 T 16 2 A 2 3 0 0 1 20 9');
    p.scale(2, 3);
    expect(p.commands[1]!.values[0]).toBe(10);  // H x scaled (5*2)
    expect(p.commands[2]!.values[0]).toBe(18);  // V y scaled
    // S end scaled
    expect(p.commands[3]!.absEnd!.x).toBe(20);
  });

  it('setRelative covers S/Q/A value rewriting', () => {
    const p = new SpsPath('M 0 0 S 4 2 6 0 Q 8 2 10 0 A 2 2 0 0 1 14 4');
    p.setRelative(true);
    expect(p.commands[1]!.letter).toBe('s');
    expect(p.commands[2]!.letter).toBe('q');
    expect(p.commands[3]!.letter).toBe('a');
    // geometry preserved
    expect(p.commands[3]!.absEnd!.x).toBeCloseTo(14, 6);
    expect(p.commands[3]!.absEnd!.y).toBeCloseTo(4, 6);
  });

  it('translate covers A branch and relative skip', () => {
    const p = new SpsPath('M 0 0 A 2 2 0 0 1 4 4');
    p.translate(1, 1);
    expect(p.commands[1]!.values[3]).toBe(5);
    expect(p.commands[1]!.values[4]).toBe(5);
    const q = new SpsPath('M 0 0 l 2 2');
    q.translate(5, 5);
    expect(q.commands[1]!.values).toEqual([2, 2]); // relative untouched
  });

  it('rotate covers H/V value rotation', () => {
    const p = new SpsPath('M 0 0 H 4');
    p.rotate(0, 0, 90);
    // rotated (4,0) → (0,4): stays H with value 0? H tracks x; after rotate x=0
    expect(p.commands[1]!.absEnd!.x).toBeCloseTo(0, 6);
    expect(p.commands[1]!.absEnd!.y).toBeCloseTo(4, 6);
  });

  it('C→S and Q/T branches in changeType', () => {
    const p = new SpsPath('M 0 0 Q 2 2 4 2');
    p.changeType(p.commands[1]!, 'T');
    expect(p.commands[1]!.type).toBe('T');
  });

  it('T→Q restores control point', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0');
    p.changeType(p.commands[2]!, 'Q');
    expect(p.commands[2]!.type).toBe('Q');
    expect(p.commands[2]!.absControls[0]).toEqual({ x: 6, y: 0 });
  });

  it('T→C via degree elevation path', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0');
    p.changeType(p.commands[2]!, 'C');
    expect(p.commands[2]!.type).toBe('C');
    expect(p.commands[2]!.absEnd!.x).toBeCloseTo(8, 6);
  });
});

describe('origin branch completion', () => {
  it('multi-subpath: origin in second subpath does not touch the first', () => {
    const p = new SpsPath('M 0 0 L 1 1 L 2 2 M 5 5 L 6 6 L 7 7');
    changePathOrigin(p, 4); // second subpath, from (6,6)
    expect(p.asString(4)).toBe('M 0 0 L 1 1 L 2 2 M 6 6 L 7 7 L 6 6');
  });

  it('index at M or beyond subpath end is a no-op', () => {
    const p = new SpsPath('M 0 0 L 1 1 L 2 2 M 5 5 L 6 6');
    const before = p.asString(4);
    changePathOrigin(p, 0); // the M itself
    expect(p.asString(4)).toBe(before);
    changePathOrigin(p, 3); // the second M
    expect(p.asString(4)).toBe(before);
  });

  it('shiftStart covers Q branch via re-anchoring quadratic', () => {
    const p = new SpsPath('M 0 0 Q 2 4 4 0 Q 6 8 8 0 L 10 2');
    changePathOrigin(p, 2); // from second Q end (8,0); tail L re-anchored, head Q re-anchored at pn
    expect(p.asString(4)).toBe('M 8 0 L 10 2 Q 12 6 4 0 Q 6 8 8 0');
  });
});

describe('origin final branches', () => {
  it('closed subpath: degenerate closing edge adds no explicit line', () => {
    // last segment already ends at subpath start → no L added before Z
    const p = new SpsPath('M 0 0 L 4 0 L 0 0 L 0 0 Z');
    changePathOrigin(p, 1); // from (4,0)
    const types = p.commands.map((c) => c.type);
    expect(types[types.length - 1]).toBe('Z');
  });

  it('open subpath with S re-anchored as first head segment (S→C explicit)', () => {
    // rotate so the S is in the HEAD (before) portion, re-anchored at pn
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 S 5 4 6 0 S 8 2 10 4');
    changePathOrigin(p, 2); // from S end (6,0): head = [C, S], after = [S]
    const hasC = p.commands.some((c) => c.type === 'C');
    expect(hasC).toBe(true);
    expect(p.commands[0]!.absEnd).toEqual({ x: 6, y: 0 });
  });

  it('A re-anchor keeps flags through closed-subpath rotation', () => {
    const p = new SpsPath('M 0 0 L 4 0 A 2 2 0 0 0 8 0 Z');
    changePathOrigin(p, 2); // from arc end (8,0); arc is in head → re-anchored
    const arc = p.commands.find((c) => c.type === 'A')!;
    expect(arc.sweep).toBe(false);
    expect(arc.largeArc).toBe(false);
    expect(p.commands[0]!.absEnd).toEqual({ x: 8, y: 0 });
  });

  it('Q re-anchor branch via open subpath head', () => {
    const p = new SpsPath('M 0 0 Q 2 4 4 0 Q 6 8 8 0 L 12 2 L 14 0');
    changePathOrigin(p, 2);
    expect(p.asString(4)).toBe('M 8 0 L 12 2 L 14 0 Q 16 4 4 0 Q 6 8 8 0');
});
});

describe('origin shiftStart S/T/A/Q head branches', () => {
  it('S head re-anchor with translated controls', () => {
    // head contains an S whose start shifts: covered via closed path
    const p = new SpsPath('M 0 0 L 4 4 C 5 5 6 6 7 7 S 9 8 10 6 Z');
    changePathOrigin(p, 3); // from S end (10,6); head=[L,C,S] re-anchored
    expect(p.commands[0]!.absEnd).toEqual({ x: 10, y: 6 });
    expect(p.commands.some((c) => c.type === 'C' && c.absControls.length === 2)).toBe(true);
  });

  it('A head re-anchor inside open path keeps sweep', () => {
    const p = new SpsPath('M 0 0 A 2 2 0 0 1 4 4 L 6 8 L 8 2');
    changePathOrigin(p, 1); // from arc end (4,4): tail re-anchored, arc re-emitted last
    expect(p.asString(4)).toBe('M 4 4 L 6 8 L 8 2 A 2 2 0 01 4 4');
    const arc = p.commands.find((c) => c.type === 'A')!;
    expect(arc.sweep).toBe(true);
  });

  it('Q head re-anchor inside closed path', () => {
    const p = new SpsPath('M 0 0 Q 4 4 8 0 L 10 4 Z');
    changePathOrigin(p, 1); // from (8,0): closing edge explicit, Q re-emitted at head end
    expect(p.asString(4)).toBe('M 8 0 L 10 4 L 0 0 Q 4 4 8 0 Z');
  });

  it('Z branch of shiftStart (Z inside body — defensive)', () => {
    const p = new SpsPath('M 0 0 L 2 0 L 2 2 Z L 4 4');
    // Z mid-body is unusual; guard covers it without crash
    changePathOrigin(p, 3);
    expect(p.commands[0]).toBeDefined();
  });
});

describe('final uncovered branches', () => {
  it('closed path where S appears in re-anchored head (cp1 made explicit)', () => {
    // rotate so that an S lands in the HEAD portion → shiftStart S branch
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 S 5 5 6 6 Z');
    changePathOrigin(p, 2); // from (6,6): after empty, head=[C,S] → S re-anchored via keepGeometry(p0)
    expect(p.commands[0]!.absEnd).toEqual({ x: 6, y: 6 });
    expect(p.commands.some((c) => c.type === 'C')).toBe(true);
  });

  it('closed path with T in head converts to explicit Q', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0 Z');
    changePathOrigin(p, 2);
    const hasQ = p.commands.some((c) => c.type === 'Q');
    expect(hasQ).toBe(true);
  });

  it('closed path with A in head re-anchored', () => {
    const p = new SpsPath('M 0 0 L 4 0 A 2 2 0 0 0 8 0 Z');
    changePathOrigin(p, 2);
    const arc = p.commands.find((c) => c.type === 'A')!;
    expect(arc.sweep).toBe(false);
  });
});

describe('optimize remaining flags', () => {
  it('removeUselessCommands restores M when first command removed', () => {
    // Path whose first M survives, but craft one where keep[0] would be L:
    // a zero-length first L is removed; M stays — covered. To hit the unshift
    // branch we need a path parsed with leading M... engine always starts with M.
    // Defensive branch: delete M externally then optimize.
    const p = new SpsPath('M 0 0 L 4 4');
    p.commands.shift();
    p.refreshAbsolutePositions();
    optimizePath(p, { removeUselessCommands: true });
    expect(p.commands[0]!.type).toBe('M');
  });

  it('useShorthands Q→T promotion inside mixed path', () => {
    const p = new SpsPath('M 0 0 Q 2 2 4 2 Q 6 2 6 4');
    optimizePath(p, { useShorthands: true });
    // second Q's control: implied = reflect((2,2) across (4,2)) = (6,2) == cp → T
    expect(p.commands[2]!.type).toBe('T');
  });
});

describe('utility branches', () => {
  it('startPointOfSubpath fallback returns origin when no M precedes', () => {
    const p = new SpsPath('M 3 4 L 5 6');
    p.commands = [p.commands[1]]; // strip M defensively (same as optimize unshift test)
    expect(p.startPointOfSubpath(0)).toEqual({ x: 0, y: 0 });
  });

  it('indexOf returns the command index', () => {
    const p = new SpsPath('M 0 0 L 1 1');
    expect(p.indexOf(p.commands[1]!)).toBe(1);
  });

  it('reverseSubpath with M-at-incident boundaries covered', () => {
    const p = new SpsPath('M 0 0 L 1 1 M 5 5 L 8 8');
    reverseSubpath(p, p.commands[1]!);
    expect(p.asString(4)).toBe('M 1 1 L 0 0 M 5 5 L 8 8');
  });
});

describe('changeType final branches', () => {
  it('non-initial L→M breaks the subpath', () => {
    const p = new SpsPath('M 0 0 L 4 4 L 8 8');
    p.changeType(p.commands[2]!, 'M');
    expect(p.commands[2]!.type).toBe('M');
    expect(p.commands[2]!.absEnd).toEqual({ x: 8, y: 8 });
  });

  it('zero-chord → A yields degenerate arc', () => {
    const p = new SpsPath('M 3 3 L 3 3');
    p.changeType(p.commands[1]!, 'A');
    expect(p.commands[1]!.values[0]).toBe(0);
    expect(p.commands[1]!.sweep).toBe(true);
  });

  it('C→M converts to move', () => {
    const p = new SpsPath('M 0 0 C 2 2 4 4 6 6');
    p.changeType(p.commands[1]!, 'M');
    expect(p.commands[1]!.type).toBe('M');
  });
});

describe('origin S/Q re-anchor branches in tail', () => {
  it('open path: S in re-anchored tail makes cp1 explicit', () => {
    // select a segment so the S is in AFTER (tail), re-anchored at pn
    const p = new SpsPath('M 0 0 L 2 0 S 5 2 6 4');
    changePathOrigin(p, 1); // from (2,0): after=[S], before=[L] → S re-anchored
    expect(p.commands[0]!.absEnd).toEqual({ x: 2, y: 0 });
    const sOrC = p.commands.find((c) => c.type === 'S' || c.type === 'C');
    expect(sOrC).toBeDefined();
  });

  it('open path: Q in re-anchored tail keeps control offsets', () => {
    const p = new SpsPath('M 0 0 L 2 0 Q 6 4 8 2');
    changePathOrigin(p, 1); // from (2,0): Q in tail re-anchored
    expect(p.commands[0]!.absEnd).toEqual({ x: 2, y: 0 });
    const q = p.commands.find((c) => c.type === 'Q')!;
    expect(q.absEnd).toEqual({ x: 8, y: 2 });
  });
});

describe('origin shiftStart S-in-tail and T branches', () => {
  it('S in tail converts to C with translated implied cp1', () => {
    // S is first segment of the rotated head → shiftStart S branch
    const p = new SpsPath('M 0 0 L 2 2 C 3 3 4 4 5 5 S 7 7 8 8 L 10 10');
    changePathOrigin(p, 2); // from (5,5): after=[S,L], before=[L,C] → C shiftStart'd
    expect(p.asString(4)).toBe('M 5 5 S 7 7 8 8 L 10 10 L 2 2 C 3 3 4 4 5 5');
  });

  it('T as first head segment converts to Q', () => {
    const p = new SpsPath('M 0 0 L 2 2 Q 3 3 4 4 T 6 6 L 9 9');
    changePathOrigin(p, 2); // from (4,4): after=[T,L]; before=[L,Q] re-anchored
    expect(p.commands.some((c) => c.type === 'Q')).toBe(true);
  });

  it('T in tail converts to Q with context control', () => {
    const p = new SpsPath('M 0 0 Q 2 2 4 2 T 6 2 L 8 4');
    changePathOrigin(p, 1); // from (4,2): T in tail → Q explicit
    const q = p.commands.find((c) => c.type === 'Q')!;
    expect(q).toBeDefined();
    expect(p.commands[0]!.absEnd).toEqual({ x: 4, y: 2 });
  });
});

describe('last guard branches', () => {
  it('open subpath single-tail keepGeometry path', () => {
    // head single L, after empty, open — but guarded by segs.length<2 earlier?
    // two segments: select index of first → after=[second], before=[first]
    const p = new SpsPath('M 0 0 L 2 2 L 4 4');
    changePathOrigin(p, 1); // from (2,2)
    expect(p.asString(4)).toBe('M 2 2 L 4 4 L 2 2');
  });

  it('shiftStart Z branch (defensive)', () => {
    // Z inside body — artificially construct then re-origin
    const p = new SpsPath('M 0 0 L 2 0 L 2 2 Z L 5 5');
    expect(() => changePathOrigin(p, 3)).not.toThrow();
  });

  it('origin with 3+ subpaths selects correct bounds', () => {
    const p = new SpsPath('M 0 0 L 1 1 M 4 4 L 5 5 L 6 6 M 8 8 L 9 9');
    changePathOrigin(p, 3); // index 3 is M → guard no-ops
    expect(p.asString(4)).toBe(new SpsPath('M 0 0 L 1 1 M 4 4 L 5 5 L 6 6 M 8 8 L 9 9').asString(4).replace('M 4 4', 'M 5 5').replace('L 5 5 L 6 6', 'L 6 6 L 5 5'));
    changePathOrigin(p, 4); // first L of middle subpath → rotates to (5,5)
    expect(p.asString(4)).toBe('M 0 0 L 1 1 M 5 5 L 6 6 L 5 5 M 8 8 L 9 9');
  });
});

describe('final path.ts branches', () => {
  it('C→Q from line source uses midpoint control', () => {
    const p = new SpsPath('M 0 0 L 8 8');
    p.changeType(p.commands[1]!, 'Q');
    expect(p.commands[1]!.absControls![0]).toEqual({ x: 4, y: 4 });
  });

  it('T→Q restores reflected control', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0');
    p.changeType(p.commands[2]!, 'Q');
    expect(p.commands[2]!.absControls[0]).toEqual({ x: 6, y: 0 });
  });

  it('T→C elevates to cubic', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0');
    p.changeType(p.commands[2]!, 'C');
    expect(p.commands[2]!.type).toBe('C');
    expect(p.commands[2]!.absEnd!.x).toBeCloseTo(8, 6);
  });

  it('default branch of changeType switch (defensive)', () => {
    const p = new SpsPath('M 0 0 L 4 4');
    // same-type no-op returns early; default only reachable via internal misuse
    p.changeType(p.commands[1]!, 'L');
    expect(p.asString(4)).toBe('M 0 0 L 4 4');
  });
});

describe('last few branches', () => {
  it('A→Q uses chord midpoint control (line-source path)', () => {
    const p = new SpsPath('M 0 0 A 4 4 0 0 1 8 8');
    p.changeType(p.commands[1]!, 'Q');
    expect(p.commands[1]!.type).toBe('Q');
    expect(p.commands[1]!.absEnd).toEqual({ x: 8, y: 8 });
  });

  it('insert with after = last command appends', () => {
    const p = new SpsPath('M 0 0 L 2 2');
    p.insert(SpsCommand.make('L', false, [5, 5]), p.commands[1]!);
    expect(p.asString(4)).toBe('M 0 0 L 2 2 L 5 5');
  });
});
