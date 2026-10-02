/**
 * Elliptical arc math per the W3C SVG specification (appendix F.6):
 * endpoint parameterization → center parameterization, and arc →
 * cubic bézier conversion with segments of at most 90°.
 *
 * Implemented from the published formulas; no reference source was consulted.
 */

export interface CubicSegment {
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

/**
 * Convert an arc from (x1,y1) to (x2,y2) into a list of cubic bézier segments.
 * Returns [] when the arc is degenerate (zero radii or coincident endpoints) —
 * callers should treat those cases as straight lines / no-ops per the SVG spec.
 */
export function arcToCubicSegments(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number
): CubicSegment[] {
  if (x1 === x2 && y1 === y2) return []; // zero-length arc: skipped per F.6.2
  if (rx === 0 || ry === 0) return []; // degenerate: straight line

  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // F.6.5 step 1: radii scaling up if needed
  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);

  // F.6.5 step 2: transform to unit circle space
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // F.6.6 correction of out-of-range radii
  const lambda = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rxAbs *= sqrtLambda;
    ryAbs *= sqrtLambda;
  }

  // F.6.5 step 3: compute center in prime space
  const rx2 = rxAbs * rxAbs;
  const ry2 = ryAbs * ryAbs;
  const numerator = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const denominator = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let root = 0;
  if (denominator !== 0 && numerator >= 0) root = Math.sqrt(Math.max(0, numerator / denominator));
  if (largeArc === sweep) root = -root;

  const cxp = (root * rxAbs * y1p) / ryAbs;
  const cyp = (-root * ryAbs * x1p) / rxAbs;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // F.6.5 step 4: angles
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs);
  let deltaTheta = angle((x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs, (-x1p - cxp) / rxAbs, (-y1p - cyp) / ryAbs);
  if (!sweep && deltaTheta > 0) deltaTheta -= TAU;
  if (sweep && deltaTheta < 0) deltaTheta += TAU;

  // F.6.6: split into segments of at most 90°
  const segments: CubicSegment[] = [];
  const count = Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2));
  const delta = deltaTheta / count;
  const t = (4 / 3) * Math.tan(delta / 4);

  let th = theta1;
  let px = x1;
  let py = y1;
  for (let i = 0; i < count; i++) {
    const th2 = th + delta;
    const cosTh = Math.cos(th);
    const sinTh = Math.sin(th);
    const cosTh2 = Math.cos(th2);
    const sinTh2 = Math.sin(th2);

    // Derivatives of the ellipse parametric equations, scaled by t
    const d1x = -rxAbs * sinTh;
    const d1y = ryAbs * cosTh;
    const d2x = -rxAbs * sinTh2;
    const d2y = ryAbs * cosTh2;

    const cp1x = px + t * (cosPhi * d1x - sinPhi * d1y);
    const cp1y = py + t * (sinPhi * d1x + cosPhi * d1y);
    const endX = cx + rxAbs * cosPhi * cosTh2 - ryAbs * sinPhi * sinTh2;
    const endY = cy + rxAbs * sinPhi * cosTh2 + ryAbs * cosPhi * sinTh2;
    const cp2x = endX - t * (cosPhi * d2x - sinPhi * d2y);
    const cp2y = endY - t * (sinPhi * d2x + cosPhi * d2y);

    segments.push({ cp1x, cp1y, cp2x, cp2y, x: endX, y: endY });
    px = endX;
    py = endY;
    th = th2;
  }

  return segments;
}

/** Sample a point on the arc at parameter t∈[0,1] (for property-testing arc conversions). */
export function sampleArc(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
  t: number
): { x: number; y: number } {
  const segs = arcToCubicSegments(x1, y1, rx, ry, rotDeg, largeArc, sweep, x2, y2);
  if (segs.length === 0) {
    // degenerate: line
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
  }
  // evaluate the bézier chain at t
  const scaled = t * segs.length;
  const idx = Math.min(segs.length - 1, Math.floor(scaled));
  const local = scaled - idx;
  const seg = segs[idx]!;
  const start = idx === 0 ? { x: x1, y: y1 } : { x: segs[idx - 1]!.x, y: segs[idx - 1]!.y };
  const b0 = (1 - local) ** 3;
  const b1 = 3 * local * (1 - local) ** 2;
  const b2 = 3 * local ** 2 * (1 - local);
  const b3 = local ** 3;
  return {
    x: b0 * start.x + b1 * seg.cp1x + b2 * seg.cp2x + b3 * seg.x,
    y: b0 * start.y + b1 * seg.cp1y + b2 * seg.cp2y + b3 * seg.y
  };
}
