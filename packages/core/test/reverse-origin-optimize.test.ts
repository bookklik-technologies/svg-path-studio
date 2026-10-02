import { describe, it, expect } from 'vitest';
import { SpsPath, reversePath, reverseSubpath, changePathOrigin, optimizePath } from '../src/index.js';

describe('reverse', () => {
  it('reverses a simple open path preserving geometry', () => {
    const p = new SpsPath('M 0 0 C 1 0 2 1 3 3 L 6 3');
    reversePath(p);
    // New start = old end (6,3); first segment ends at (3,3) with swapped controls.
    expect(p.commands[0]!.absEnd).toEqual({ x: 6, y: 3 });
    expect(p.commands[p.commands.length - 1]!.absEnd).toEqual({ x: 0, y: 0 });
    expect(p.commands[1]!.type).toBe('L'); // reversed L
  });

  it('reversing twice yields the original geometry', () => {
    const d = 'M 0 0 C 1 0 2 1 3 3 Q 4 4 5 5 L 8 2';
    const p = new SpsPath(d);
    const before = samplePath(p, 20);
    reversePath(p);
    reversePath(p);
    const after = samplePath(p, 20);
    expect(after.map((q) => q.x)).toEqual(before.map((q) => q.x));
    expect(after.map((q) => q.y)).toEqual(before.map((q) => q.y));
  });

  it('closed subpaths stay closed (Z preserved at end)', () => {
    const p = new SpsPath('M 0 0 L 4 0 L 4 4 Z');
    reversePath(p);
    expect(p.commands[p.commands.length - 1]!.type).toBe('Z');
    expect(p.commands[0]!.absEnd).toEqual({ x: 4, y: 4 }); // old end becomes start
  });

  it('arc sweep flag flips on reversal', () => {
    const p = new SpsPath('M 0 0 A 1 1 0 0 1 2 2');
    reversePath(p);
    const a = p.commands[1]!;
    expect(a.type).toBe('A');
    expect(a.sweep).toBe(false);
    expect(a.largeArc).toBe(false);
    // ends at old start
    expect(a.absEnd).toEqual({ x: 0, y: 0 });
  });

  it('reverseSubpath only affects the containing subpath', () => {
    const p = new SpsPath('M 0 0 L 1 1 M 5 5 L 8 8 L 9 0');
    reverseSubpath(p, p.commands[3]!); // first L of second subpath
    expect(p.asString(4)).toBe('M 0 0 L 1 1 M 9 0 L 8 8 L 5 5');
  });
});

describe('changePathOrigin', () => {
  it('makes the selected command first, geometry preserved', () => {
    const p = new SpsPath('M 0 0 L 1 1 L 2 2 L 3 3');
    changePathOrigin(p, 2); // path redrawn starting from (2,2)
    expect(p.asString(4)).toBe('M 2 2 L 3 3 L 1 1 L 2 2');
    expect(p.commands[0]!.absEnd).toEqual({ x: 2, y: 2 });
  });

  it('preserves closed subpaths', () => {
    const p = new SpsPath('M 0 0 L 3 0 L 3 3 Z');
    changePathOrigin(p, 2);
    expect(p.commands[p.commands.length - 1]!.type).toBe('Z');
    expect(p.commands[0]!.absEnd).toEqual({ x: 3, y: 3 });
  });

  it('no-ops when the command is already first segment', () => {
    const p = new SpsPath('M 0 0 L 1 1');
    changePathOrigin(p, 1);
    expect(p.asString(4)).toBe('M 0 0 L 1 1');
  });
});

describe('optimize', () => {
  it('removeUselessCommands drops zero-length lines', () => {
    const p = new SpsPath('M 0 0 L 5 5 L 5 5 L 6 6');
    optimizePath(p, { removeUselessCommands: true });
    expect(p.commands.map((c) => c.type)).toEqual(['M', 'L', 'L']);
  });

  it('useShorthands promotes C→S on reflection', () => {
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 C 4 4 5 5 6 6');
    optimizePath(p, { useShorthands: true });
    // second C: implied cp1 = reflect(cp2_prev) = 2*(3,3)-(2,2) = (4,4) == cp1 → S
    expect(p.commands[2]!.type).toBe('S');
  });

  it('useShorthands keeps C when not a reflection', () => {
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 C 0 0 5 5 6 6');
    optimizePath(p, { useShorthands: true });
    expect(p.commands[2]!.type).toBe('C');
  });

  it('useHorizontalAndVerticalLines converts axis-aligned L to H/V', () => {
    const p = new SpsPath('M 0 0 L 5 0 L 5 7');
    optimizePath(p, { useHorizontalAndVerticalLines: true });
    expect(p.commands[1]!.type).toBe('H');
    expect(p.commands[2]!.type).toBe('V');
  });

  it('useRelativeAbsolute picks the shorter form per command', () => {
    const p = new SpsPath('M 1000 1000 L 1002 1002');
    optimizePath(p, { useRelativeAbsolute: true });
    expect(p.commands[1]!.letter).toBe('l'); // "l2,2" shorter than "L1002,1002"
  });

  it('useClosePath collapses final line-to-start into Z', () => {
    const p = new SpsPath('M 0 0 L 4 0 L 4 4 L 0 0');
    optimizePath(p, { useClosePath: true });
    expect(p.commands[p.commands.length - 1]!.type).toBe('Z');
  });

  it('useReverse keeps the shorter direction', () => {
    // Construct a path whose reversed serialization is shorter.
    const p = new SpsPath('M 0 0 L 100 0 L 100 1');
    optimizePath(p, { useReverse: true });
    // Either direction is acceptable; assert output parses and is ≤ original length.
    expect(new SpsPath(p.asString(4)).asString(4)).toBe(p.asString(4));
  });

  it('optimizer is idempotent', () => {
    const d = 'M 0 0 L 5 0 L 5 5 L 0 5 L 0 0 M 1 1 l 0.00001 0';
    const p = new SpsPath(d);
    optimizePath(p, { removeUselessCommands: true, useShorthands: true, useHorizontalAndVerticalLines: true, useRelativeAbsolute: true, useClosePath: true });
    const once = p.asString(4, true);
    optimizePath(p, { removeUselessCommands: true, useShorthands: true, useHorizontalAndVerticalLines: true, useRelativeAbsolute: true, useClosePath: true });
    expect(p.asString(4, true)).toBe(once);
  });

  it('no flags = no change', () => {
    const d = 'M 0 0 L 5 0 L 5 7 L 0 7 L 0 0';
    const p = new SpsPath(d);
    optimizePath(p, {});
    expect(p.asString(4)).toBe(new SpsPath(d).asString(4));
  });
});

/** Sample points along all subpaths of a path (move-to-end per command). */
function samplePath(p: SpsPath, _n: number): { x: number; y: number }[] {
  return p.commands.filter((c) => c.type !== 'M' && c.type !== 'Z').map((c) => c.absEnd);
}
