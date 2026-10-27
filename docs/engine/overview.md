# Engine overview

[`@bookklik/svg-path-studio`](https://www.npmjs.com/package/@bookklik/svg-path-studio) — the `packages/core` workspace — is the same engine the editor uses: a **zero-dependency** SVG path library with a headless editor controller. It runs in Node (18+) or any modern browser/bundler. There is no framework, DOM, or runtime dependency, and no pointer/keyboard listeners, storage, or network side effects of any kind.

```sh
npm install @bookklik/svg-path-studio
```

Imports are ES modules with TypeScript declarations. CommonJS consumers can use dynamic `import()`.

## Stateless path objects

```ts
import { SpsPath, reversePath, optimizePath, SpsParseError } from '@bookklik/svg-path-studio';

const path = new SpsPath('M0 0 L10 10');
path.scale(2, 2);
path.setRelative(true);
reversePath(path);
optimizePath(path, { useHorizontalAndVerticalLines: true });
console.log(path.asString(4, true)); // minified with 4 decimals
```

- `SpsPath` parses a `d` string into a **editable, serialisable path object**: per-command access, transforms (`scale`, `translate`, …), relative/absolute conversion, and `asString(precision, minified)` output.
- Invalid input throws `SpsParseError` with the exact character **`index`** and a **`reason`**.
- For an empty stateless path, use `new SpsPath()` rather than `new SpsPath('')`.
- Non-empty paths must begin with a moveto.

## Path operations

| API | Effect |
| --- | --- |
| `path.scale(x, y)` | Scale around the path origin. |
| `path.translate(x, y)` | Translate by X/Y offsets. |
| `path.setRelative(bool)` | Convert every command to relative or absolute form. |
| `reversePath(path)` | Reverse the draw direction. |
| `optimizePath(path, options)` | Apply the [optimizer flags](/engine/optimize). |
| `path.asString(precision, minified)` | Serialize; `asString(4, true)` gives a minified 4-decimal string. |

Module layout of the core: `parse.ts`, `serialize.ts`, `path.ts`, `command.ts`, `arc.ts`, `optimize.ts`, `reverse.ts`, `origin.ts`.

## Headless editor

Build your own UI without the ribbon, styles, clipboard or service worker: `createPathEditor` from `@bookklik/svg-path-studio/headless` gives subscriptions, atomic edits, undo/redo, and full-precision snapshots. See the [Headless editor guide](/engine/headless).
