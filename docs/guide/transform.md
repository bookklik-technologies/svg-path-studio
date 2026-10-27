# Transforms & path tools

The **Transform** tab operates on the whole current path.

## Geometry transforms

- **Scale** — scale the path around its origin by X/Y factors.
- **Translate** — move the path by X/Y offsets.
- **Rotate** — rotate the path by a given angle.
- **Round coordinates** — reduce stored coordinate precision to a uniform number of decimals.

## Coordinates

- **Relative** — rewrite the path in relative form.
- **Absolute** — rewrite the path in absolute form.

Path engines differ: relative and absolute encodings can produce different string sizes for the same geometry, which matters for [SVG output](/guide/view#svg-output) tuning.

## Path tools

- **Reverse** — flip the draw direction of the path; useful when `stroke-dasharray` animations start from the wrong end.

All operations undo with <kbd>Ctrl</kbd>+<kbd>Z</kbd>.

::: tip Programmatic equivalents
Every toolbar operation is available in the engine as a method on <code>SpsPath</code> (`scale()`, `translate()`, `setRelative()`, …) plus `reversePath()` and `optimizePath()`. See [Engine overview](/engine/overview).
:::
