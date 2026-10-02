import { COMMAND_ARITY, CommandType, Point } from './types.js';

let nextId = 1;

/**
 * A single path command.
 *
 * `values` holds the coordinate values as written (relative or absolute).
 * For A commands, rx/ry/rotation/x/y live in `values` while the two boolean
 * flags are kept in `largeArc`/`sweep` (the parser packs run-together flags).
 *
 * Cached absolute positions (`absStart` = position before this command,
 * `absEnd` = position after it, plus per-type control points) are maintained
 * by SpsPath.refreshAbsolutePositions().
 */
export class SpsCommand {
  /** Monotonic identity, stable across edits (useful for UI selection). */
  readonly id = nextId++;

  type: CommandType;
  relative: boolean;
  values: number[];
  largeArc = false;
  sweep = false;

  // Cached absolute geometry (recomputed by refreshAbsolutePositions):
  absStart: Point = { x: 0, y: 0 };
  absEnd: Point = { x: 0, y: 0 };
  /** C: cp1, cp2 · S: cp2 (cp1 implied) · Q: cp · T: cp (implied) */
  absControls: Point[] = [];

  private constructor(type: CommandType, relative: boolean, values: number[]) {
    this.type = type;
    this.relative = relative;
    this.values = values;
  }

  static make(type: CommandType, relative: boolean, values: number[]): SpsCommand {
    const arity = COMMAND_ARITY[type];
    if (values.length !== arity) {
      throw new Error(`Command ${type} requires ${arity} value(s), got ${values.length}`);
    }
    return new SpsCommand(type, relative, [...values]);
  }

  /** Human-readable letter reflecting relative/absolute state. */
  get letter(): string {
    return this.relative ? this.type.toLowerCase() : this.type;
  }

  clone(): SpsCommand {
    const c = new SpsCommand(this.type, this.relative, [...this.values]);
    c.largeArc = this.largeArc;
    c.sweep = this.sweep;
    return c;
  }

  /** Toggle this command between relative and absolute, preserving geometry. */
  setRelative(rel: boolean): void {
    this.relative = rel; // value rewrite is handled by SpsPath.setRelative
  }
}
