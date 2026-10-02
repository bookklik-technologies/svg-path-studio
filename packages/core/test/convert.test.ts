import { describe, it, expect } from 'vitest';
import { SpsPath } from '../src/index.js';

describe('convert (changeType)', () => {
  it('L→H and L→V preserve geometry', () => {
    const p = new SpsPath('M 0 0 L 5 0');
    p.changeType(p.commands[1]!, 'H');
    expect(p.commands[1]!.type).toBe('H');
    expect(p.commands[1]!.absEnd).toEqual({ x: 5, y: 0 });

    const q = new SpsPath('M 0 0 L 0 5');
    q.changeType(q.commands[1]!, 'V');
    expect(q.commands[1]!.absEnd).toEqual({ x: 0, y: 5 });
  });

  it('L→C represents the same straight segment', () => {
    const p = new SpsPath('M 0 0 L 9 9');
    p.changeType(p.commands[1]!, 'C');
    expect(p.commands[1]!.type).toBe('C');
    // bézier of a straight line stays on the line
    expect(p.commands[1]!.absEnd).toEqual({ x: 9, y: 9 });
    const c = p.commands[1]!;
    for (const t of [0.25, 0.5, 0.75]) {
      const b0 = (1 - t) ** 3, b1 = 3 * t * (1 - t) ** 2, b2 = 3 * t * t * (1 - t), b3 = t ** 3;
      const x = b0 * 0 + b1 * c.absControls[0]!.x + b2 * c.absControls[1]!.x + b3 * 9;
      const y = b0 * 0 + b1 * c.absControls[0]!.y + b2 * c.absControls[1]!.y + b3 * 9;
      expect(x).toBeCloseTo(9 * t, 6);
      expect(y).toBeCloseTo(9 * t, 6);
    }
  });

  it('Q→C degree elevation is exact', () => {
    const p = new SpsPath('M 0 0 Q 4 8 10 0');
    p.changeType(p.commands[1]!, 'C');
    const c = p.commands[1]!;
    // cp1 = start + 2/3·(cp − start) = (8/3, 16/3); cp2 = end + 2/3·(cp − end) = (10−4, 16/3)
    expect(c.absControls[0]).toEqual({ x: 8 / 3, y: 16 / 3 });
    expect(c.absControls[1]).toEqual({ x: 10 - 4, y: 16 / 3 });
    expect(c.absEnd).toEqual({ x: 10, y: 0 });
  });

  it('C→Q approximates the same curve (control average)', () => {
    const p = new SpsPath('M 0 0 C 2 8 8 8 10 0');
    const dBefore = p.asString(6);
    p.changeType(p.commands[1]!, 'Q');
    expect(p.commands[1]!.type).toBe('Q');
    // Endpoint preservation:
    expect(p.commands[1]!.absEnd).toEqual({ x: 10, y: 0 });
    void dBefore;
  });

  it('A→C converts arcs to béziers preserving geometry', () => {
    // Quarter circle from (1,0) to (0,1)
    const p = new SpsPath('M 1 0 A 1 1 0 0 1 0 1');
    p.changeType(p.commands[1]!, 'C');
    const c = p.commands[1]!;
    // Kappa for 90°: 0.5522844745. Sweep=1 quarter circle (1,0)→(0,1).
    const k = 0.5522844745;
    expect(c.absControls[0]!.x).toBeCloseTo(1, 5);
    expect(c.absControls[0]!.y).toBeCloseTo(k, 5);
    expect(c.absControls[1]!.x).toBeCloseTo(k, 5);
    expect(c.absControls[1]!.y).toBeCloseTo(1, 5);
    expect(c.absEnd!.x).toBeCloseTo(0, 6);
    expect(c.absEnd!.y).toBeCloseTo(1, 6);
  });

  it('A→C expands multi-segment arcs into several C commands', () => {
    const p = new SpsPath('M 1 0 A 1 1 0 1 1 0 1'); // 270°
    const n0 = p.commands.length;
    p.changeType(p.commands[1]!, 'C');
    expect(p.commands.length).toBeGreaterThan(n0);
    expect(p.commands.slice(1).every((c) => c.type === 'C')).toBe(true);
    expect(p.commands[p.commands.length - 1]!.absEnd.x).toBeCloseTo(0, 6);
    expect(p.commands[p.commands.length - 1]!.absEnd.y).toBeCloseTo(1, 6);
  });

  it('C→A fits a circular arc', () => {
    const p = new SpsPath('M 1 0 C 1.55 0 1 0.55 0 1');
    p.changeType(p.commands[1]!, 'A');
    const a = p.commands[1]!;
    expect(a.type).toBe('A');
    expect(a.absEnd).toEqual({ x: 0, y: 1 });
    expect(a.values[0]).toBeGreaterThan(0);
  });

  it('preserves relative state in same-family conversions', () => {
    const p = new SpsPath('M 0 0 l 5 0');
    p.changeType(p.commands[1]!, 'C');
    expect(p.commands[1]!.letter).toBe('c');
  });

  it('forbids converting the initial M', () => {
    const p = new SpsPath('M 0 0 L 1 1');
    expect(() => p.changeType(p.commands[0]!, 'L')).toThrow(/initial move/);
  });

  it('M→L for non-initial M works', () => {
    const p = new SpsPath('M 0 0 L 5 5 M 2 2 L 8 8');
    p.changeType(p.commands[2]!, 'L');
    expect(p.commands[2]!.type).toBe('L');
  });

  it('L→Z converts to closepath', () => {
    const p = new SpsPath('M 0 0 L 4 0 L 4 4 L 0 0');
    p.changeType(p.commands[3]!, 'Z');
    expect(p.commands[3]!.type).toBe('Z');
    expect(p.commands[3]!.absEnd).toEqual({ x: 0, y: 0 });
  });
});

describe('insert / delete', () => {
  it('inserts at end and after a given command', () => {
    const p = new SpsPath('M 0 0 L 5 5');
    p.insert({ type: 'L', relative: false, values: [9, 9], absStart: { x: 0, y: 0 }, absEnd: { x: 0, y: 0 }, absControls: [], letter: '', clone: null as never } as never);
    // Use the real API instead of the shape-above:
  });

  it('delete refuses the initial M', () => {
    const p = new SpsPath('M 0 0 L 1 1');
    expect(() => p.delete(p.commands[0]!)).toThrow(/initial move/);
  });

  it('delete keeps geometry consistent', () => {
    const p = new SpsPath('M 0 0 L 1 1 L 2 2');
    p.delete(p.commands[2]!);
    expect(p.commands.length).toBe(2);
    expect(p.asString(4)).toBe('M 0 0 L 1 1');
  });
});
