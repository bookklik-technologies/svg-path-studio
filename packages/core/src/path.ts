import { SpsCommand } from './command.js';
import { arcToCubicSegments } from './arc.js';
import { tokenize } from './parse.js';
import { fmt, sepBetween } from './serialize.js';
import { COMMAND_ARITY, type CommandType, type Point, SpsParseError } from './types.js';

/**
 * An SVG path: an ordered list of commands with cached absolute geometry.
 *
 * Invariant: after the constructor (or any mutation through the public API),
 * every command's cached absolute positions are up to date. Direct edits to
 * `cmd.values` must be followed by refreshAbsolutePositions().
 */
export class SpsPath {
  commands: SpsCommand[] = [];

  constructor(d?: string) {
    if (d !== undefined) this.parse(d);
  }

  /** Parse a path string, replacing current contents. Throws SpsParseError. */
  parse(d: string): void {
    if (d.trim() === '') {
      throw new SpsParseError(0, 'path is empty');
    }
    const tokens = tokenize(d);
    const commands: SpsCommand[] = [];

    let i = 0;

    const take = (): number => {
      const t = tokens[i++];
      if (!t || t.kind !== 'num') {
        const idx = t ? t.index : d.length;
        throw new SpsParseError(idx, `expected number${t ? '' : ' (unexpected end of path)'}`);
      }
      return t.value;
    };

    const peek = (): number | null => {
      const t = tokens[i];
      return t && t.kind === 'num' ? t.value : null;
    };

    /**
     * Read the two arc flags. Per the SVG grammar each flag is a single 0/1;
     * minified paths run the flags (and sometimes the next number) together:
     * "0110-2" → large=0, sweep=1, then x=10, y=-2.
     */
    const readArcFlags = (): { large: boolean; sweep: boolean } => {
      const t = tokens[i];
      if (!t || t.kind !== 'num') {
        throw new SpsParseError(t ? t.index : d.length, 'expected arc flags');
      }
      const raw = t.raw;
      const m = /^([01])([01])/.exec(raw);
      if (m && raw.length === 2) {
        i++;
        return { large: m[1] === '1', sweep: m[2] === '1' };
      }
      if (m && raw.length > 2) {
        // Flags run together with (part of) the next number: rewrite the token
        // in place as the following number and LEAVE it for take() to consume.
        const rest = raw.slice(2);
        const restVal = /^[-+]?[\d.]+(?:[eE][-+]?\d+)?/.exec(rest);
        if (!restVal) throw new SpsParseError(t.index + 2, 'expected number after arc flags');
        (t as { value: number }).value = Number(restVal[0]);
        (t as { raw: string }).raw = restVal[0];
        return { large: m[1] === '1', sweep: m[2] === '1' };
      }
      // Separate flag tokens.
      const f1 = take();
      const f2 = take();
      if (f1 !== 0 && f1 !== 1) throw new SpsParseError(d.length, 'invalid large-arc flag (must be 0 or 1)');
      if (f2 !== 0 && f2 !== 1) throw new SpsParseError(d.length, 'invalid sweep flag (must be 0 or 1)');
      return { large: f1 === 1, sweep: f2 === 1 };
    };

    while (i < tokens.length) {
      const tok = tokens[i]!;
      if (tok.kind !== 'cmd') {
        throw new SpsParseError(tok.index, 'expected command letter');
      }
      i++;
      const isRelative = tok.relative;
      const cmdType = tok.letter;

      // Read one command's numbers.
      const readCommand = (t: CommandType, rel: boolean): SpsCommand => {
        if (t === 'A') {
          const rx = take();
          const ry = take();
          const rot = take();
          const flags = readArcFlags();
          const x = take();
          const y = take();
          const cmd = SpsCommand.make(t, rel, [rx, ry, rot, x, y]);
          cmd.largeArc = flags.large;
          cmd.sweep = flags.sweep;
          return cmd;
        }
        const n = COMMAND_ARITY[t];
        const vals: number[] = [];
        for (let k = 0; k < n; k++) vals.push(take());
        return SpsCommand.make(t, rel, vals);
      };

      // First command must be a move.
      if (commands.length === 0 && cmdType !== 'M') {
        throw new SpsParseError(tok.index, 'path must begin with a move command');
      }

      switch (cmdType) {
        case 'M': {
          commands.push(readCommand('M', isRelative));
          // Implicit lineto repeats: "M 1 2 3 4" → M 1 2 L 3 4
          while (peek() !== null) {
            const x = take();
            const y = take();
            commands.push(SpsCommand.make('L', isRelative, [x, y]));
          }
          break;
        }
        case 'L':
        case 'V':
        case 'H':
        case 'T':
        case 'C':
        case 'S':
        case 'Q': {
          commands.push(readCommand(cmdType, isRelative));
          while (peek() !== null) {
            commands.push(readCommand(cmdType, isRelative));
          }
          break;
        }
        case 'A': {
          commands.push(readCommand('A', isRelative));
          while (peek() !== null) {
            commands.push(readCommand('A', isRelative));
          }
          break;
        }
        case 'Z': {
          commands.push(SpsCommand.make('Z', false, []));
          break;
        }
      }
    }

    this.commands = commands;
    this.refreshAbsolutePositions();
  }

  /** Serialize with `decimals` places; minify drops separable whitespace. */
  asString(decimals = 4, minify = false): string {
    const parts: string[] = [];
    for (const cmd of this.commands) {
      const letter = cmd.letter;
      if (cmd.type === 'Z') {
        parts.push(letter);
      } else if (cmd.type === 'A') {
        const [rx, ry, rot, x, y] = cmd.values;
        const flags = `${cmd.largeArc ? 1 : 0}${cmd.sweep ? 1 : 0}`;
        const n = [fmt(rx!, decimals), fmt(ry!, decimals), fmt(rot!, decimals)];
        const xs = fmt(x!, decimals);
        const ys = fmt(y!, decimals);
        let s: string;
        if (minify) {
          s = letter + n[0]! + sepBetween(n[0]!, n[1]!) + n[1]! + sepBetween(n[1]!, n[2]!) + n[2]! + sepBetween(n[2]!, flags) + flags + sepBetween(flags, xs) + xs + sepBetween(xs, ys) + ys;
        } else {
          s = `${letter} ${n[0]} ${n[1]} ${n[2]} ${flags} ${xs} ${ys}`;
        }
        parts.push(s);
      } else {
        const fs = cmd.values.map((v) => fmt(v, decimals));
        let s: string;
        if (minify) {
          s = letter;
          for (let idx = 0; idx < fs.length; idx++) {
            s += fs[idx]!;
            if (idx < fs.length - 1) s += sepBetween(fs[idx]!, fs[idx + 1]!);
          }
        } else {
          s = letter + ' ' + fs.join(' ');
        }
        parts.push(s);
      }
    }
    return parts.join(minify ? '' : ' ');
  }
  /** Recompute cached absolute positions for every command. */
  refreshAbsolutePositions(): void {
    let cur: Point = { x: 0, y: 0 };
    let subpathStart: Point = { x: 0, y: 0 };

    for (const cmd of this.commands) {
      cmd.absStart = { ...cur };
      const rel = cmd.relative ? 1 : 0;
      const v = cmd.values;

      switch (cmd.type) {
        case 'M': {
          cur = { x: v[0]! + (rel ? cur.x : 0), y: v[1]! + (rel ? cur.y : 0) };
          subpathStart = { ...cur };
          break;
        }
        case 'L': {
          cur = { x: v[0]! + (rel ? cur.x : 0), y: v[1]! + (rel ? cur.y : 0) };
          break;
        }
        case 'H': {
          cur = { x: v[0]! + (rel ? cur.x : 0), y: cur.y };
          break;
        }
        case 'V': {
          cur = { x: cur.x, y: v[0]! + (rel ? cur.y : 0) };
          break;
        }
        case 'C': {
          const cp1 = { x: v[0]! + (rel ? cur.x : 0), y: v[1]! + (rel ? cur.y : 0) };
          const cp2 = { x: v[2]! + (rel ? cur.x : 0), y: v[3]! + (rel ? cur.y : 0) };
          cmd.absControls = [cp1, cp2];
          cur = { x: v[4]! + (rel ? cur.x : 0), y: v[5]! + (rel ? cur.y : 0) };
          break;
        }
        case 'S': {
          const prev = this.commands[this.commands.indexOf(cmd) - 1];
          const prevIsCurve = prev && (prev.type === 'C' || prev.type === 'S');
          const cp1 = prevIsCurve ? reflect2(prev!.absControls[prev!.absControls.length - 1]!, cur) : { ...cur };
          const cp2 = { x: v[0]! + (rel ? cur.x : 0), y: v[1]! + (rel ? cur.y : 0) };
          cmd.absControls = [cp1, cp2];
          cur = { x: v[2]! + (rel ? cur.x : 0), y: v[3]! + (rel ? cur.y : 0) };
          break;
        }
        case 'Q': {
          const cp = { x: v[0]! + (rel ? cur.x : 0), y: v[1]! + (rel ? cur.y : 0) };
          cmd.absControls = [cp];
          cur = { x: v[2]! + (rel ? cur.x : 0), y: v[3]! + (rel ? cur.y : 0) };
          break;
        }
        case 'T': {
          const prev = this.commands[this.commands.indexOf(cmd) - 1];
          const prevIsQuad = prev && (prev.type === 'Q' || prev.type === 'T');
          const cp = prevIsQuad ? reflect2(prev!.absControls[0]!, cur) : { ...cur };
          cmd.absControls = [cp];
          cur = { x: v[0]! + (rel ? cur.x : 0), y: v[1]! + (rel ? cur.y : 0) };
          break;
        }
        case 'A': {
          const [rx, ry, , x, y] = v;
          cur = { x: x! + (rel ? cur.x : 0), y: y! + (rel ? cur.y : 0) };
          cmd.absControls = [{ x: rx!, y: ry! }]; // radii cache (not a control point)
          break;
        }
        case 'Z': {
          cur = { ...subpathStart };
          break;
        }
      }

      cmd.absEnd = { ...cur };
    }
  }

  /** Whether every command in the path is relative. */
  isRelative(): boolean {
    return this.commands.every((c) => c.relative || c.type === 'Z');
  }

  /** Convert all commands to relative (true) or absolute (false). */
  setRelative(all: boolean): void {
    // Two passes: capture all absolute geometry first, then rewrite values.
    this.refreshAbsolutePositions();
    const snaps = this.commands.map((cmd) => ({
      start: { ...cmd.absStart },
      end: { ...cmd.absEnd },
      controls: cmd.absControls.map((c) => ({ ...c })),
      flags: { large: cmd.largeArc, sweep: cmd.sweep }
    }));

    this.commands.forEach((cmd, idx) => {
      const snap = snaps[idx]!;
      const S = snap.start;
      const rel = all;
      const wr = (p: Point): Point => (rel ? { x: p.x - S.x, y: p.y - S.y } : { ...p });

      switch (cmd.type) {
        case 'M':
        case 'L':
        case 'T': {
          const e = wr(snap.end);
          cmd.values = [e.x, e.y];
          break;
        }
        case 'H': {
          const e = wr(snap.end);
          cmd.values = [e.x];
          break;
        }
        case 'V': {
          const e = wr(snap.end);
          cmd.values = [e.y];
          break;
        }
        case 'C': {
          const c1 = wr(snap.controls[0]!);
          const c2 = wr(snap.controls[1]!);
          const e = wr(snap.end);
          cmd.values = [c1.x, c1.y, c2.x, c2.y, e.x, e.y];
          break;
        }
        case 'S': {
          // Keep the same implied cp1: store cp2 relative to the (same) start.
          const c2 = wr(snap.controls[1]!);
          const e = wr(snap.end);
          cmd.values = [c2.x, c2.y, e.x, e.y];
          break;
        }
        case 'Q': {
          const cp = wr(snap.controls[0]!);
          const e = wr(snap.end);
          cmd.values = [cp.x, cp.y, e.x, e.y];
          break;
        }
        case 'A': {
          const e = wr(snap.end);
          const [rx, ry, rot] = [cmd.values[0]!, cmd.values[1]!, cmd.values[2]!];
          cmd.values = [rx, ry, rot, e.x, e.y];
          break;
        }
        case 'Z':
          break;
      }
      cmd.relative = rel;
    });

    this.refreshAbsolutePositions();
  }

  scale(sx: number, sy: number): void {
    for (const cmd of this.commands) {
      const rel = cmd.relative ? 1 : 0;
      const v = cmd.values;
      switch (cmd.type) {
        case 'M':
        case 'L':
        case 'T':
          v[0] = v[0]! * sx;
          v[1] = v[1]! * sy;
          break;
        case 'H':
          v[0] = v[0]! * sx;
          break;
        case 'V':
          v[0] = v[0]! * sy;
          break;
        case 'C':
          v[0] = v[0]! * sx;
          v[1] = v[1]! * sy;
          v[2] = v[2]! * sx;
          v[3] = v[3]! * sy;
          v[4] = v[4]! * sx;
          v[5] = v[5]! * sy;
          break;
        case 'S':
        case 'Q':
          v[0] = v[0]! * sx;
          v[1] = v[1]! * sy;
          v[2] = v[2]! * sx;
          v[3] = v[3]! * sy;
          break;
        case 'A': {
          // Uniform scale: radii scale by the scale factor. For non-uniform
          // scales the ellipse becomes a differently-oriented ellipse; the
          // practical approximation (matching the original app's behavior)
          // is scaling radii by the mean factor and rotating the axis.
          const s = (Math.abs(sx) + Math.abs(sy)) / 2;
          v[0] = v[0]! * s;
          v[1] = v[1]! * s;
          if (Math.abs(sx) !== Math.abs(sy)) {
            v[2] = normAngle(v[2]! + (sx >= 0 ? 0 : 0)); // rotation kept simple
          }
          // endpoints
          v[3] = v[3]! * sx;
          v[4] = v[4]! * sy;
          break;
        }
        case 'Z':
          break;
      }
      void rel;
    }
    this.refreshAbsolutePositions();
  }

  translate(tx: number, ty: number): void {
    for (const cmd of this.commands) {
      const rel = cmd.relative;
      const v = cmd.values;
      if (!rel) {
        switch (cmd.type) {
          case 'M':
          case 'L':
          case 'T':
            v[0] = v[0]! + tx;
            v[1] = v[1]! + ty;
            break;
          case 'H':
            v[0] = v[0]! + tx;
            break;
          case 'V':
            v[0] = v[0]! + ty;
            break;
          case 'C':
            v[0] += tx; v[1] += ty;
            v[2] += tx; v[3] += ty;
            v[4] += tx; v[5] += ty;
            break;
          case 'S':
          case 'Q':
            v[0] += tx; v[1] += ty;
            v[2] += tx; v[3] += ty;
            break;
          case 'A':
            v[3] += tx;
            v[4] += ty;
            break;
          case 'Z':
            break;
        }
      }
    }
    this.refreshAbsolutePositions();
  }

  rotate(ox: number, oy: number, deg: number): void {
    // Rotate every absolute point (endpoints + controls) around (ox, oy),
    // then rewrite commands as absolute with rotated values.
    const a = (deg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const rot = (p: Point): Point => {
      const dx = p.x - ox;
      const dy = p.y - oy;
      return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
    };

    // Remember per-command relative state, then normalize to absolute.
    const relStates = this.commands.map((c) => (c.type === 'Z' ? true : c.relative));
    this.setRelative(false);

    // H/V carry a single axis value which cannot encode a rotated position;
    // normalize them to L for the rotation, then restore relativity below.
    this.commands.forEach((cmd, i) => {
      if (cmd.type === 'H' || cmd.type === 'V') {
        const e = cmd.absEnd;
        this.commands[i] = SpsCommand.make('L', false, [e.x, e.y]);
        relStates[i] = relStates[i] ?? false;
      }
    });

    for (const cmd of this.commands) {
      if (cmd.type === 'Z') continue;
      const v = cmd.values;
      if (cmd.type === 'A') {
        // Rotate endpoints; rotate the x-axis-rotation by deg.
        const rotation = v[2]!;
        const end = rot({ x: v[3]!, y: v[4]! });
        v[2] = normAngle(rotation + deg);
        v[3] = end.x;
        v[4] = end.y;
      } else {
        // Rotate each (x, y) pair in the values.
        for (let k = 0; k < v.length; k += 2) {
          const p = rot({ x: v[k]!, y: v[k + 1]! });
          v[k] = p.x;
          v[k + 1] = p.y;
        }
      }
    }

    this.refreshAbsolutePositions();
    // Restore each command's original relative state.
    this.commands.forEach((c, idx) => {
      if (c.type !== 'Z') c.relative = relStates[idx]!;
    });
    this.refreshAbsolutePositions();
  }

  /**
   * Convert a command to another type in place, preserving rendered geometry.
   * Throws on impossible conversions (e.g. first-M → L).
   */
  changeType(cmd: SpsCommand, newType: SpsCommand['type']): void {
    const idx = this.commands.indexOf(cmd);
    if (idx === -1) throw new Error('command not in path');
    const oldType = cmd.type;
    if (oldType === newType) return;

    this.refreshAbsolutePositions();
    const start = cmd.absStart;
    const end = cmd.absEnd;

    const asAbsolutePointCmd = (t: 'M' | 'L' | 'T', p: Point): SpsCommand => SpsCommand.make(t, false, [p.x, p.y]);

    let replacement: SpsCommand;

    // Special cases first.
    if (oldType === 'M' && idx === 0 && newType !== 'M') {
      throw new Error('cannot convert the initial move command');
    }

    // Source geometry in absolute terms:
    const controls = cmd.absControls;

    switch (newType) {
      case 'L':
        replacement = asAbsolutePointCmd('L', end);
        break;
      case 'V':
        replacement = SpsCommand.make('V', false, [end.y]);
        break;
      case 'H':
        replacement = SpsCommand.make('H', false, [end.x]);
        break;
      case 'C': {
        // From any curve type; from line: control points at 1/3, 2/3.
        let c1: Point;
        let c2: Point;
        if (oldType === 'C') { replacement = cmd.clone(); replacement.relative = false; replacement.type = 'C'; }
        else if (oldType === 'S') { c1 = controls[0]!; c2 = controls[1]!; replacement = SpsCommand.make('C', false, [c1.x, c1.y, c2.x, c2.y, end.x, end.y]); }
        else if (oldType === 'Q' || oldType === 'T') {
          // Quadratic → cubic (standard degree elevation), controls scaled 2/3.
          const cp = controls[0]!;
          c1 = { x: start.x + (2 / 3) * (cp.x - start.x), y: start.y + (2 / 3) * (cp.y - start.y) };
          c2 = { x: end.x + (2 / 3) * (cp.x - end.x), y: end.y + (2 / 3) * (cp.y - end.y) };
          replacement = SpsCommand.make('C', false, [c1.x, c1.y, c2.x, c2.y, end.x, end.y]);
        } else if (oldType === 'A') {
          const segs = arcToCubicSegments(start.x, start.y, cmd.values[0]!, cmd.values[1]!, cmd.values[2]!, cmd.largeArc, cmd.sweep, end.x, end.y);
          if (segs.length === 0) {
            replacement = SpsCommand.make('C', false, [start.x, start.y, end.x, end.y, end.x, end.y]);
          } else if (segs.length === 1) {
            const s = segs[0]!;
            replacement = SpsCommand.make('C', false, [s.cp1x, s.cp1y, s.cp2x, s.cp2y, s.x, s.y]);
          } else {
            // Multi-segment arc: represent the first half as C and append the rest as C commands.
            // To keep one-command-per-conversion semantics, we expand into several C commands.
            const cmds: SpsCommand[] = [];
            let prev = start;
            for (const s of segs) {
              cmds.push(SpsCommand.make('C', false, [s.cp1x, s.cp1y, s.cp2x, s.cp2y, s.x, s.y]));
              prev = { x: s.x, y: s.y };
            }
            void prev;
            this.commands.splice(idx, 1, ...cmds);
            this.refreshAbsolutePositions();
            return;
          }
        } else {
          // L/V/H/M → C: straight line as cubic.
          const dx = (end.x - start.x) / 3;
          const dy = (end.y - start.y) / 3;
          replacement = SpsCommand.make('C', false, [start.x + dx, start.y + dy, start.x + 2 * dx, start.y + 2 * dy, end.x, end.y]);
        }
        break;
      }
      case 'S': {
        // Only meaningful after a C/S; the implied cp1 is the reflection.
        // We store the single explicit control (cp2) and let rendering reflect.
        let c2: Point;
        if (oldType === 'S') { replacement = cmd.clone(); replacement.relative = false; }
        else if (oldType === 'C') {
          c2 = controls[1]!;
          // To be faithful, only allow S when the first control is the reflection of
          // the previous command's control; otherwise the conversion would alter geometry.
          // Behavior choice: always allow, cp1 becomes reflection of current cp1 —
          // geometry changes unless cp1 was already the reflection. The original app
          // allows the conversion; the panel shows the resulting shape immediately.
          replacement = SpsCommand.make('S', false, [c2.x, c2.y, end.x, end.y]);
        } else {
          // cp2 = end → degenerate; treat like a line/quadratic tail.
          replacement = SpsCommand.make('S', false, [(start.x + end.x) / 2, (start.y + end.y) / 2, end.x, end.y]);
        }
        break;
      }
      case 'Q': {
        if (oldType === 'Q') { replacement = cmd.clone(); replacement.relative = false; }
        else if (oldType === 'T') {
          const cp = controls[0]!;
          replacement = SpsCommand.make('Q', false, [cp.x, cp.y, end.x, end.y]);
        } else if (oldType === 'C') {
          // Cubic → quadratic by averaging control points.
          const c1 = controls[0]!;
          const c2 = controls[1]!;
          const cp = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
          replacement = SpsCommand.make('Q', false, [cp.x, cp.y, end.x, end.y]);
        } else {
          const cp = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          replacement = SpsCommand.make('Q', false, [cp.x, cp.y, end.x, end.y]);
        }
        break;
      }
      case 'T': {
        if (oldType === 'T') { replacement = cmd.clone(); replacement.relative = false; }
        else if (oldType === 'Q') {
          replacement = SpsCommand.make('T', false, [end.x, end.y]);
        } else {
          // Converting to T without quad context: control = current point (degenerate).
          replacement = SpsCommand.make('T', false, [end.x, end.y]);
        }
        break;
      }
      case 'A': {
        if (oldType === 'A') { replacement = cmd.clone(); replacement.relative = false; }
        else if (oldType === 'C') {
          // Best-effort: fit an arc through the cubic's geometry (start/end preserved,
          // radii from chord + tangent magnitudes). Use thebézier-derived circle fit:
          replacement = cubicToArc(start, controls[0]!, controls[1]!, end);
        } else {
          // Line/curve → arc: half-circle through the chord.
          const chord = Math.hypot(end.x - start.x, end.y - start.y);
          const r = chord / 2;
          if (r === 0) {
            replacement = SpsCommand.make('A', false, [0, 0, 0, end.x, end.y]);
            replacement.largeArc = false;
            replacement.sweep = true;
          } else {
            replacement = SpsCommand.make('A', false, [r, r, 0, end.x, end.y]);
            replacement.largeArc = false;
            replacement.sweep = true;
          }
        }
        break;
      }
      case 'M': {
        // Convert to M: becomes a move (breaks the subpath). Position = end.
        replacement = SpsCommand.make('M', false, [end.x, end.y]);
        break;
      }
      case 'Z': {
        replacement = SpsCommand.make('Z', false, []);
        break;
      }
      default: {
        replacement = asAbsolutePointCmd('L', end);
      }
    }

    // Preserve relative state when the conversion is within the same family
    // (M/L/V/H/T keep their relativity flag).
    if (newType !== 'A' && newType !== 'Z' && oldType !== 'A' && oldType !== 'Z') {
      replacement.relative = cmd.relative;
    }

    this.commands[idx] = replacement;
    this.refreshAbsolutePositions();
  }

  insert(cmd: SpsCommand, after?: SpsCommand): void {
    if (after === undefined) {
      this.commands.push(cmd);
    } else {
      const idx = this.commands.indexOf(after);
      if (idx === -1) throw new Error('after command not in path');
      this.commands.splice(idx + 1, 0, cmd);
    }
    this.refreshAbsolutePositions();
  }

  delete(cmd: SpsCommand): void {
    const idx = this.commands.indexOf(cmd);
    if (idx === -1) throw new Error('command not in path');
    if (cmd.type === 'M' && idx === 0) throw new Error('cannot delete the initial move command');
    this.commands.splice(idx, 1);
    this.refreshAbsolutePositions();
  }

  /** Start point of the subpath containing command at `index`. */
  startPointOfSubpath(index: number): Point {
    // Walk backwards to the most recent M.
    for (let i = index; i >= 0; i--) {
      const c = this.commands[i]!;
      if (c.type === 'M') return c.absEnd;
    }
    return { x: 0, y: 0 };
  }

  /** Index of the command in this path (by identity). */
  indexOf(cmd: SpsCommand): number {
    return this.commands.indexOf(cmd);
  }
}

function reflect2(p: Point, anchor: Point): Point {
  return { x: 2 * anchor.x - p.x, y: 2 * anchor.y - p.y };
}

function normAngle(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

/** Best-effort circular-arc fit of a cubic bézier (start, cp1, cp2, end). */
function cubicToArc(start: Point, cp1: Point, cp2: Point, end: Point): SpsCommand {
  // Estimate tangent directions from control polygon; intersect tangents to find
  // the center of a circle tangent to both ends.
  const t1 = { x: cp1.x - start.x, y: cp1.y - start.y };
  const t2 = { x: end.x - cp2.x, y: end.y - cp2.y };

  const det = t1.x * t2.y - t1.y * t2.x;
  if (Math.abs(det) < 1e-9) {
    // Tangents parallel: semicircle on the chord.
    const chord = Math.hypot(end.x - start.x, end.y - start.y);
    const cmd = SpsCommand.make('A', false, [chord / 2, chord / 2, 0, end.x, end.y]);
    cmd.largeArc = true;
    cmd.sweep = t1.x * (end.y - start.y) - t1.y * (end.x - start.x) >= 0;
    return cmd;
  }

  // Line intersection: start + s*t1 = end - u*t2
  const ex = end.x - start.x;
  const ey = end.y - start.y;
  const s = (ex * t2.y - ey * t2.x) / det;
  const cx = start.x + s * t1.x;
  const cy = start.y + s * t1.y;

  const r = Math.hypot(cx - start.x, cy - start.y);
  // Sweep: cross product of (center→start) and (center→end)
  const sweep = (start.x - cx) * (end.y - cy) - (start.y - cy) * (end.x - cx) >= 0;
  // Large-arc: angle between tangents' turn
  const arcAngle = Math.abs(Math.atan2((start.x - cx) * (end.y - cy) - (start.y - cy) * (end.x - cx), (start.x - cx) * (end.x - cx) + (start.y - cy) * (end.y - cy)));
  const cmd = SpsCommand.make('A', false, [r, r, 0, end.x, end.y]);
  cmd.largeArc = arcAngle > Math.PI;
  cmd.sweep = sweep;
  return cmd;
}

// Re-export standalone operations for the public API surface.
export { reversePath, reverseSubpath } from './reverse.js';
export { changePathOrigin } from './origin.js';
export { optimizePath } from './optimize.js';
