/** Shared types and errors for @svg-path-studio/core */

export interface Point {
  x: number;
  y: number;
}

export type CommandType = 'M' | 'L' | 'V' | 'H' | 'C' | 'S' | 'Q' | 'T' | 'A' | 'Z';

/** Number of coordinate values carried by each command type (flags excluded). */
export const COMMAND_ARITY: Record<CommandType, number> = {
  M: 2,
  L: 2,
  V: 1,
  H: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 5, // rx, ry, x-axis-rotation, x, y  (large-arc/sweep flags stored separately)
  Z: 0
};

/** Thrown when a path string cannot be parsed. `index` is the character offset in the input. */
export class SpsParseError extends Error {
  readonly index: number;
  readonly reason: string;

  constructor(index: number, reason: string) {
    super(`Invalid path at index ${index}: ${reason}`);
    this.name = 'SpsParseError';
    this.index = index;
    this.reason = reason;
  }
}

export interface OptimizeOptions {
  /** Remove zero-length segments and redundant move commands. */
  removeUselessCommands?: boolean;
  /** Promote C→S and Q→T when the discarded control point is the exact reflection. */
  useShorthands?: boolean;
  /** Convert axis-aligned lines to H/V. */
  useHorizontalAndVerticalLines?: boolean;
  /** Pick relative-vs-absolute per command, whichever serializes shorter. */
  useRelativeAbsolute?: boolean;
  /** Reverse the whole path if that yields a shorter serialization. */
  useReverse?: boolean;
  /** Drop subpaths that render as isolated dots (destructive for stroked paths). */
  removeOrphanDots?: boolean;
  /** Collapse final line-to-start segments into Z (destructive for stroked paths). */
  useClosePath?: boolean;
}
