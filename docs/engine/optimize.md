# Optimizer flags

`optimizePath(path, options)` runs **seven independent, default-off flags** in a fixed, deterministic order, with a single pass per flag.

```ts
import { optimizePath } from '@bookklik/svg-path-studio';

optimizePath(path, { useShorthands: true, useHorizontalAndVerticalLines: true });
```

| Flag | Pass | Effect |
| --- | --- | --- |
| `removeUselessCommands` | 1 | Removes zero-length segments and duplicated moveto commands (the later `M` wins). |
| `useShorthands` | 2 | Promotes `C`/`Q` to `S`/`T` shorthand where the reflected control point matches. |
| `useHorizontalAndVerticalLines` | 3 | Converts axis-aligned `L` segments to `H`/`V`. |
| `useRelativeAbsolute` | 4 | For each command, chooses the shortest of the relative and absolute forms. |
| `removeOrphanDots` | 5 | Removes isolated single-dot commands. |
| `useClosePath` | 6 | Converts a final `L` back to the subpath start into `Z`. |
| `useReverse` | 7 | Reverses the path when that makes its encoding shorter. |

## Notes

- Every flag is **off by default**; enable only what you want.
- The passes are **deterministic**: the same input always produces the same output.
- Geometry caches are refreshed before and after the passes.
- The flags compose: for example, combining `useShorthands` + `useRelativeAbsolute` + `useClosePath` typically gives the biggest size reduction on hand-authored paths.

The editor exposes the same optimizer through the [View tab's SVG output settings](/guide/view#svg-output) — see the minify/precision choices there. The editor's optimize runs the preset combination; the library here gives you per-flag control.
