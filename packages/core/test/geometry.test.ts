import { describe, it, expect } from 'vitest';
import { SpsPath } from '../src/index.js';

describe('absolute bookkeeping', () => {
  it('tracks absolute end positions through relative commands', () => {
    const p = new SpsPath('M 1 1 l 2 2 l 3 0 h 1 v 1');
    expect(p.commands[1]!.absEnd).toEqual({ x: 3, y: 3 });
    expect(p.commands[2]!.absEnd).toEqual({ x: 6, y: 3 });
    expect(p.commands[3]!.absEnd).toEqual({ x: 7, y: 3 });
    expect(p.commands[4]!.absEnd).toEqual({ x: 7, y: 4 });
  });

  it('Z returns to subpath start', () => {
    const p = new SpsPath('M 1 1 L 5 5 L 9 1 Z');
    expect(p.commands[3]!.absEnd).toEqual({ x: 1, y: 1 });
  });

  it('S reflects the previous control point', () => {
    const p = new SpsPath('M 0 0 C 1 1 2 2 3 3 S 5 0 6 0');
    const s = p.commands[2]!; // M, C, S
    expect(s.absControls[0]).toEqual({ x: 4, y: 4 }); // 2*(3,3)-(2,2)
  });

  it('S after non-curve uses current point as cp1', () => {
    const p = new SpsPath('M 0 0 L 2 2 S 5 0 6 0');
    const s = p.commands[2]!; // M, L, S
    expect(s.absControls[0]).toEqual({ x: 2, y: 2 });
  });

  it('T reflects the previous quadratic control', () => {
    const p = new SpsPath('M 0 0 Q 2 0 4 0 T 8 0');
    const t = p.commands[2]!; // M, Q, T
    expect(t.absControls[0]).toEqual({ x: 6, y: 0 }); // reflect (2,0) across (4,0)
  });

  it('refreshAbsolutePositions recalculates after direct value edits', () => {
    const p = new SpsPath('M 0 0 l 2 2');
    p.commands[1]!.values[0] = 10;
    p.commands[1]!.values[1] = 5;
    p.refreshAbsolutePositions();
    expect(p.commands[1]!.absEnd).toEqual({ x: 10, y: 5 });
  });
});

describe('setRelative', () => {
  it('converts to absolute', () => {
    const p = new SpsPath('M 1 1 l 2 2 c 1 0 2 1 3 3');
    p.setRelative(false);
    expect(p.commands[1]!.letter).toBe('L');
    expect(p.commands[1]!.values).toEqual([3, 3]);
    expect(p.commands[2]!.letter).toBe('C');
    // C starts at (3,3): cp1=(4,3), cp2=(5,4), end=(6,6)
    expect(p.commands[2]!.values).toEqual([4, 3, 5, 4, 6, 6]);
  });

  it('converts to relative', () => {
    const p = new SpsPath('M 1 1 L 3 3 C 5 1 6 2 7 4');
    p.setRelative(true);
    expect(p.commands[1]!.letter).toBe('l');
    expect(p.commands[1]!.values).toEqual([2, 2]);
    expect(p.commands[2]!.letter).toBe('c');
    // C starts (3,3): cp1=(2,-2) cp2=(3,-1) end=(4,1)
    expect(p.commands[2]!.values).toEqual([2, -2, 3, -1, 4, 1]);
  });

  it('round-trips geometry through relative↔absolute', () => {
    const d = 'M 4 8 L 10 1 C 6 10 6 11 7 10 A 1.42 1.42 0 0 1 6 13 Q 3.5 9.9 3.5 10.5 Z';
    const p = new SpsPath(d);
    const before = p.asString(3);
    p.setRelative(true);
    p.setRelative(false);
    expect(p.asString(3)).toBe(before);
  });
});

describe('transforms', () => {
  it('translates absolute and relative paths identically', () => {
    const a = new SpsPath('M 1 1 L 5 5');
    a.translate(2, 3);
    expect(a.asString(4)).toBe('M 3 4 L 7 8');

    const b = new SpsPath('M 1 1 l 4 4');
    b.translate(2, 3);
    expect(b.asString(4)).toBe('M 3 4 l 4 4');
  });

  it('scales coordinates and radii', () => {
    const p = new SpsPath('M 2 3 L 4 6 A 1 1 0 0 1 6 9');
    p.scale(2, 2);
    expect(p.commands[1]!.values).toEqual([8, 12]);
    const a = p.commands[2]!;
    expect(a.values[0]).toBe(2);
    expect(a.values[3]).toBe(12);
    expect(a.values[4]).toBe(18);
  });

  it('rotates 90° around origin', () => {
    const p = new SpsPath('M 1 0 L 2 0');
    p.rotate(0, 0, 90);
    expect(p.commands[0]!.values[0]).toBeCloseTo(0);
    expect(p.commands[0]!.values[1]).toBeCloseTo(1);
    expect(p.commands[1]!.values[0]).toBeCloseTo(0);
    expect(p.commands[1]!.values[1]).toBeCloseTo(2);
  });

  it('rotate preserves relative style', () => {
    const p = new SpsPath('M 1 0 l 1 0');
    p.rotate(0, 0, 90);
    expect(p.commands[1]!.letter).toBe('l');
  });
});
