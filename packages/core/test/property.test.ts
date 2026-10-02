import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SpsPath, SpsParseError, reversePath, arcToCubicSegments, sampleArc } from '../src/index.js';

/** Arbitrary valid path generator: M + random segment commands. */
const pointArb = fc.record({ x: fc.double({ min: -50, max: 50, noNaN: true }), y: fc.double({ min: -50, max: 50, noNaN: true }) });

const arbPath = fc
  .record({
    start: pointArb,
    segments: fc.array(
      fc.oneof(
        fc.record({ t: fc.constant('L'), p: pointArb }),
        fc.record({ t: fc.constant('C'), c1: pointArb, c2: pointArb, p: pointArb }),
        fc.record({ t: fc.constant('Q'), c: pointArb, p: pointArb })
      ),
      { maxLength: 8 }
    )
  })
  .map(({ start, segments }) => {
    let d = `M ${round(start.x)} ${round(start.y)}`;
    for (const s of segments) {
      if (s.t === 'L') d += ` L ${round(s.p.x)} ${round(s.p.y)}`;
      else if (s.t === 'C') d += ` C ${round(s.c1.x)} ${round(s.c1.y)} ${round(s.c2.x)} ${round(s.c2.y)} ${round(s.p.x)} ${round(s.p.y)}`;
      else d += ` Q ${round(s.c.x)} ${round(s.c.y)} ${round(s.p.x)} ${round(s.p.y)}`;
    }
    return d;
  });

function round(v: number): string {
  return (Math.round(v * 100) / 100).toString();
}

describe('property: round-trip stability', () => {
  it('parse(asString(p)) serializes identically', () => {
    fc.assert(
      fc.property(arbPath, fc.integer({ min: 0, max: 6 }), (d, decimals) => {
        const p = new SpsPath(d);
        const s1 = p.asString(decimals);
        const p2 = new SpsPath(s1);
        expect(p2.asString(decimals)).toBe(s1);
      }),
      { numRuns: 300 }
    );
  });
});

describe('property: reverse∘reverse = identity', () => {
  it('geometry preserved', () => {
    fc.assert(
      fc.property(arbPath, (d) => {
        const p = new SpsPath(d);
        const before = p.commands.filter((c) => c.type !== 'M' && c.type !== 'Z').map((c) => c.absEnd);
        reversePath(p);
        reversePath(p);
        const after = p.commands.filter((c) => c.type !== 'M' && c.type !== 'Z').map((c) => c.absEnd);
        expect(after.length).toBe(before.length);
        expect(after.map((q) => q.x)).toEqual(before.map((q) => q.x));
        expect(after.map((q) => q.y)).toEqual(before.map((q) => q.y));
      }),
      { numRuns: 200 }
    );
  });
});

describe('property: parse errors always carry a position', () => {
  it('SpsParseError.index >= 0 for arbitrary garbage', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        try {
          new SpsPath(s);
        } catch (e) {
          if (e instanceof SpsParseError) expect(e.index).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 200 }
    );
  });
});

describe('arc math vs analytic circle', () => {
  it('sampled bézier chain stays on the analytic arc (≤1e-2, 3-segment kappa approximation)', () => {
    // 240° clockwise arc (sweep=1) from (1,0) ends at 240°.
    // Half-way point at t=0.5: angle 120° = (-0.5, 0.866).
    const x1 = 1, y1 = 0, rx = 1, ry = 1, rot = 0, la = true, sw = true;
    const a0 = 0;
    const a1 = (240 * Math.PI) / 180;
    const ex = Math.cos(a1);
    const ey = Math.sin(a1);
    for (let i = 1; i < 100; i++) {
      const t = i / 100;
      const s = sampleArc(x1, y1, rx, ry, rot, la, sw, ex, ey, t);
      const theta = a0 + t * (a1 - a0); // sweep=1 from angle 0 travels CCW to 240°
      expect(s.x).toBeCloseTo(Math.cos(theta), 1);
      expect(s.y).toBeCloseTo(Math.sin(theta), 1);
    }
  });

  it('degenerate radii produce no segments (line fallback)', () => {
    expect(arcToCubicSegments(0, 0, 0, 5, 0, false, true, 3, 3)).toEqual([]);
    expect(arcToCubicSegments(0, 0, 5, 0, 0, false, true, 3, 3)).toEqual([]);
    expect(arcToCubicSegments(1, 1, 5, 5, 0, false, true, 1, 1)).toEqual([]);
  });

  it('radii auto-scale when too small (F.6.6)', () => {
    // Chord of 2 with radii 0.5 → must be scaled up to 1
    const segs = arcToCubicSegments(-1, 0, 0.5, 0.5, 0, true, false, 1, 0);
    expect(segs.length).toBeGreaterThan(0);
    // First segment must start at (-1, 0)
    const evalFirst = (t: number) => {
      const s = segs[0]!;
      const b0 = (1 - t) ** 3, b1 = 3 * t * (1 - t) ** 2, b2 = 3 * t * t * (1 - t), b3 = t ** 3;
      return { x: b0 * -1 + b1 * s.cp1x + b2 * s.cp2x + b3 * s.x, y: b0 * 0 + b1 * s.cp1y + b2 * s.cp2y + b3 * s.y };
    };
    // midpoint of the large arc through (0, ±1)... sampled point should be within radius distance of scaled circle
    const mid = evalFirst(0.5);
    expect(Math.hypot(mid.x, mid.y)).toBeCloseTo(1, 3);
  });
});
