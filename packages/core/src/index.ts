/**
 * @svg-path-studio/core — zero-dependency SVG path engine.
 *
 * Public API:
 * - {@link SpsPath}: parse, serialize, transform, edit an SVG path
 * - {@link SpsCommand}: a single path command
 * - {@link reversePath}, {@link reverseSubpath}, {@link changePathOrigin}, {@link optimizePath}
 * - {@link SpsParseError}: thrown for invalid path strings
 */

export { SpsPath } from './path.js';
export { SpsCommand } from './command.js';
export { SpsParseError, COMMAND_ARITY } from './types.js';
export type { CommandType, OptimizeOptions, Point } from './types.js';
export { reversePath, reverseSubpath } from './reverse.js';
export { changePathOrigin } from './origin.js';
export { optimizePath } from './optimize.js';
export { arcToCubicSegments, sampleArc } from './arc.js';
