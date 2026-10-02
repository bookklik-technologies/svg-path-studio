import { CommandType, SpsParseError } from './types.js';

/**
 * Tokenizer for the SVG 1.1 path grammar.
 *
 * Produces a token stream of command letters (case-preserving — the case IS
 * the relative/absolute flag) and numbers (with their raw source text so the
 * parser can split run-together arc flags).
 */
export type Token =
  | { kind: 'cmd'; letter: CommandType; relative: boolean; index: number }
  | { kind: 'num'; value: number; raw: string; index: number };

const CMD_LETTERS = 'MmLlVvHhCcSsQqTtAaZz';

/** SVG path number: sign? (integer | float) exponent? — also accepts leading dot. */
const NUM_RE = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const isSeparator = (ch: string): boolean =>
    ch === ',' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';

  while (i < input.length) {
    const ch = input[i]!;

    if (isSeparator(ch)) {
      i++;
      continue;
    }

    if (CMD_LETTERS.includes(ch)) {
      const upper = ch.toUpperCase();
      tokens.push({ kind: 'cmd', letter: upper as CommandType, relative: ch !== upper, index: i });
      i++;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '.' || (ch >= '0' && ch <= '9')) {
      const m = NUM_RE.exec(input.slice(i));
      if (!m || m[0].length === 0 || m[0] === '+' || m[0] === '-') {
        throw new SpsParseError(i, `unexpected character "${ch}"`);
      }
      tokens.push({ kind: 'num', value: Number(m[0]), raw: m[0], index: i });
      i += m[0].length;
      continue;
    }

    throw new SpsParseError(i, `unexpected character "${ch}"`);
  }

  return tokens;
}

/** True if `ch` is a command letter (either case). */
export function isCommandLetter(ch: string): boolean {
  return CMD_LETTERS.includes(ch);
}
