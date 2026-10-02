import { describe, it, expect } from 'vitest';
import { SpsPath, changePathOrigin, optimizePath, reverseSubpath } from '../src/index.js';

describe('origin: advanced cases', () => {
  it('rotates a closed subpath with S and T commands', () => {
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 S 4 4 5 5 Z');
    changePathOrigin(p, 2); // from end of S (5,5)
    expect(p.commands[0]!.absEnd).toEqual({ x: 5, y: 5 });
    expect(p.commands[p.commands.length - 1]!.type).toBe('Z');
    // All points still visited: (5,5), (0,0) via closing edge, (3,3)
    const ends = p.commands.slice(1).map((c) => c.absEnd);
    expect(ends.some((e) => e.x === 3 && e.y === 3)).toBe(true);
    expect(ends.some((e) => e.x === 0 && e.y === 0)).toBe(true);
  });

  it('converts T to explicit Q when rotated out of context', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0 Z');
    changePathOrigin(p, 2); // from (8,0)
    expect(p.commands[0]!.absEnd).toEqual({ x: 8, y: 0 });
    expect(p.commands[2]!.type).toBe('Q'); // was T, now explicit Q
  });

  it('re-origins a subpath with an arc', () => {
    const p = new SpsPath('M 0 0 L 4 0 A 2 2 0 0 1 8 0 L 8 4 Z');
    changePathOrigin(p, 2); // from arc end (8,0)
    expect(p.commands[0]!.absEnd).toEqual({ x: 8, y: 0 });
    const arc = p.commands.find((c) => c.type === 'A')!;
    expect(arc).toBeDefined();
    expect(arc.largeArc).toBe(false);
  });
});

describe('optimize: remaining branches', () => {
  it('removeUselessCommands drops redundant consecutive M', () => {
    const p = new SpsPath('M 0 0 M 2 2 L 3 3');
    optimizePath(p, { removeUselessCommands: true });
    expect(p.commands.map((c) => c.type)).toEqual(['M', 'L']);
    expect(p.commands[0]!.absEnd).toEqual({ x: 2, y: 2 });
  });

  it('removeUselessCommands keeps path starting with M', () => {
    const p = new SpsPath('M 0 0 L 5 5');
    optimizePath(p, { removeUselessCommands: true });
    expect(p.commands[0]!.type).toBe('M');
  });

  it('removeOrphanDots drops isolated moveto subpaths', () => {
    const p = new SpsPath('M 0 0 L 5 5 M 9 9 M 2 2 L 3 3');
    optimizePath(p, { removeOrphanDots: true });
    // "M 9 9" (orphan) removed; others kept
    expect(p.asString(4)).toBe(new SpsPath('M 0 0 L 5 5 M 2 2 L 3 3').asString(4));
  });

  it('useShorthands promotes Q→T on reflection', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0');
    optimizePath(p, { useShorthands: true });
    expect(p.commands[2]!.type).toBe('T');
  });

  it('chooseShortestRelAbs keeps state on tie', () => {
    const p = new SpsPath('M 0 0 l 1 1');
    optimizePath(p, { useRelativeAbsolute: true });
    // "l1,1" vs "L1,1": equal length → tie keeps relative
    expect(p.commands[1]!.letter).toBe('l');
  });
});

describe('reverse: S and T become explicit on reversal', () => {
  it('S reverses to C with reflected controls', () => {
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 S 4 2 6 0');
    reverseSubpath(p, p.commands[2]!);
    expect(p.commands[2]!.type).toBe('C');
    // reversed path ends at original start
    expect(p.commands[p.commands.length - 1]!.absEnd).toEqual({ x: 0, y: 0 });
  });

  it('T reverses to Q with reflected control', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0');
    reverseSubpath(p, p.commands[2]!);
    expect(p.commands[2]!.type).toBe('Q');
    expect(p.commands[p.commands.length - 1]!.absEnd).toEqual({ x: 0, y: 0 });
  });
});
