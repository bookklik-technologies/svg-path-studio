/**
 * Number formatting for serialization.
 *
 * fmt produces a decimal string with trailing zeros trimmed.
 * sepBetween decides the separator between two consecutive formatted numbers
 * under minification: a sign or (in dot-context) a period can terminate the
 * previous number per the SVG grammar; a leading digit never can.
 */

export function fmt(v: number, decimals = 4): string {
  if (!Number.isFinite(v)) return '0';
  let s = v.toFixed(decimals);
  if (s.includes('.')) {
    s = s.replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    if (s.endsWith('.')) s = s.slice(0, -1);
  }
  if (s === '-0') s = '0';
  return s === '' ? '0' : s;
}

/** Separator between prev and next formatted numbers in minified output. */
export function sepBetween(prevFmt: string, nextFmt: string): string {
  const n0 = nextFmt[0] ?? ' ';
  if (n0 === '-' || n0 === '+') return '';
  if (n0 === '.') return prevFmt.includes('.') ? '' : ' ';
  return ' ';
}
