import { describe, it, expect } from 'vitest';
import { SpsPath, SpsParseError } from '../src/index.js';

describe('parser: full SVG 1.1 grammar', () => {
  it('parses every command type', () => {
    const p = new SpsPath('M 1 1 L 4 4 V 8 H 2 C 5 5 6 6 7 7 S 3 3 2 2 Q 1 1 0.5 0.5 T 1 1 A 2 2 0 0 1 5 5 Z');
    expect(p.commands.map((c) => c.type)).toEqual(['M', 'L', 'V', 'H', 'C', 'S', 'Q', 'T', 'A', 'Z']);
  });

  it('accepts lowercase (relative) and mixed case', () => {
    const p = new SpsPath('M1 1 l2 2 L 5 5 c 1 1 2 2 3 3');
    expect(p.commands.map((c) => c.letter).join('')).toBe('MlLc');
    expect(p.commands[1]!.relative).toBe(true);
  });

  it('handles implicit repeats after M', () => {
    const p = new SpsPath('M 1 2 3 4 5 6');
    expect(p.commands.map((c) => c.type)).toEqual(['M', 'L', 'L']);
    expect(p.commands[1]!.values).toEqual([3, 4]);
  });

  it('handles implicit repeats for curves', () => {
    const p = new SpsPath('M0 0 L1 1 2 2 3 3');
    expect(p.commands.length).toBe(4);
  });

  it('tokenizes separators: commas, newlines, tabs, negative run-together', () => {
    const p = new SpsPath('M1,2L3-4\n5\t6');
    expect(p.commands[1]!.values).toEqual([3, -4]);
  });

  it('parses scientific notation and leading-dot decimals', () => {
    const p = new SpsPath('M 1e2 .5 L 2E-1 3.');
    expect(p.commands[0]!.values[0]).toBe(100);
    expect(p.commands[0]!.values[1]).toBe(0.5);
    expect(p.commands[1]!.values[0]).toBeCloseTo(0.2);
    expect(p.commands[1]!.values[1]).toBe(3);
  });

  it('parses run-together arc flags', () => {
    const p = new SpsPath('M 0 0 a4 4 0 0110-2');
    const a = p.commands[1]!;
    expect(a.type).toBe('A');
    expect(a.largeArc).toBe(false);
    expect(a.sweep).toBe(true);
    expect(a.values).toEqual([4, 4, 0, 10, -2]);
  });

  it('round-trips a complex path within formatting tolerance', () => {
    const d = 'M 4 8 L 10 1 L 13 0 L 12 3 L 5 9 C 6 10 6 11 7 10 C 7 11 8 12 7 12 A 1.42 1.42 0 0 1 6 13 Q 3.5 9.9 3.5 10.5 T 2 11.8 Z';
    const p = new SpsPath(d);
    const out = p.asString(4);
    const p2 = new SpsPath(out);
    expect(p2.asString(4)).toBe(out);
  });
});

describe('parser: errors', () => {
  it('rejects empty path', () => {
    expect(() => new SpsPath('')).toThrow(SpsParseError);
  });

  it('rejects path not starting with M', () => {
    expect(() => new SpsPath('L 1 2')).toThrow(/begin with a move/);
  });

  it('reports index of invalid character', () => {
    try {
      new SpsPath('M 1 2 X');
      expect.fail();
    } catch (e) {
      expect(e).toBeInstanceOf(SpsParseError);
      expect((e as SpsParseError).index).toBe(6);
    }
  });

  it('rejects missing numbers', () => {
    expect(() => new SpsPath('M 1')).toThrow(SpsParseError);
    expect(() => new SpsPath('M 1 2 L')).toThrow(SpsParseError);
  });

  it('rejects invalid arc flags', () => {
    expect(() => new SpsPath('M 0 0 A 1 1 0 2 0 5 5')).toThrow(/large-arc/);
    expect(() => new SpsPath('M 0 0 A 1 1 0 0 3 5 5')).toThrow(/sweep/);
  });

  it('rejects garbage', () => {
    expect(() => new SpsPath('hello')).toThrow(SpsParseError);
  });
});

describe('serialization', () => {
  it('defaults to 4 decimals with trailing-zero trim', () => {
    const p = new SpsPath('M 1.0000 2.50000 L 3 4');
    expect(p.asString()).toBe('M 1 2.5 L 3 4');
  });

  it('honors decimals parameter', () => {
    const p = new SpsPath('M 1.23456 2 L 3 4');
    expect(p.asString(2)).toBe('M 1.23 2 L 3 4');
  });

  it('minify drops separable whitespace', () => {
    const p = new SpsPath('M 1 2 L 3 4 L 5 -6');
    const m = p.asString(4, true);
    expect(m).toBe('M1 2L3 4L5-6');
  });

  it('keeps a space when a dot would be ambiguous', () => {
    const p = new SpsPath('M 1 2 L 3 4.5');
    p.commands[1]!.values[0] = 4;
    p.commands[1]!.values[1] = 0.5;
    p.refreshAbsolutePositions();
    const m = p.asString(4, true);
    expect(m).toContain('L4');
    expect(m).toMatch(/0?\.5$/);
  });
});
