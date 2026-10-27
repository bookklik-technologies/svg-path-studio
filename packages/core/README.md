# @bookklik/svg-path-studio

Zero-dependency SVG path engine and headless editor. Build your own interface without loading SVG Path Studio's ribbon, styles, storage, clipboard handlers, keyboard shortcuts or service worker.

## Installation

```sh
npm install @bookklik/svg-path-studio
```

ES modules with TypeScript declarations; Node.js 18+ or a modern browser/bundler. CommonJS consumers can use dynamic `import()`. No framework, DOM or runtime dependencies are required. This is a library, not an iframe or a prebuilt visual editor: your application owns rendering, pointer handling, selection, viewport and accessibility.

## Headless usage

```ts
import { createPathEditor } from '@bookklik/svg-path-studio/headless';
import { optimizePath } from '@bookklik/svg-path-studio';

const editor = createPathEditor({ path: 'M0 0 L10 10', historyLimit: 200 });
const unsubscribe = editor.subscribe(() => {
  console.log(editor.getSnapshot());
});

editor.edit((path) => {
  path.scale(2, 2);
  path.translate(1, 0);
  optimizePath(path, { useShorthands: true });
});
editor.undo();
editor.redo();

const output = editor.getPath().asString(4, true);
console.log(output);
unsubscribe();
editor.destroy();
```

`createPathEditor` is also exported from the main package entry.

### API contract

| Method | Behavior |
| --- | --- |
| `getSnapshot()` | Stable, frozen `{ path, commandCount, canUndo, canRedo }` until a change. Path text uses 15 decimal places with trailing zeros removed. |
| `getPath()` | Detached `SpsPath` copy with full numeric precision and refreshed geometry. Mutating it never changes the editor. |
| `subscribe(listener)` | Calls a no-argument listener synchronously after changes; returns unsubscribe. Does not call immediately. |
| `setPath(d)` | Replaces path as one undoable edit. Empty/whitespace clears it. Invalid input throws, leaving state/history unchanged. |
| `edit(mutator)` | Gives a detached mutable path to a synchronous callback; commits the result as one undo step. Exceptions and invalid geometry abort the edit. |
| `undo()` / `redo()` | Restore geometry without rounding. No-op if unavailable. A new edit discards redo history. |
| `clearHistory()` | Clears undo/redo without changing geometry. |
| `destroy()` | Releases subscriptions and history. Idempotent; later writes/subscriptions throw. Read methods remain available. |

The initial path defaults to empty. `historyLimit` defaults to 200; use 0 to disable history. It must be a non-negative integer. Non-empty paths must begin with a moveto. Edits require valid command types/arities and finite coordinates; retained drafts cannot mutate committed state. Geometry caches are refreshed on commit. No-op edits do not notify or add history. Nested mutations and asynchronous edit callbacks are unsupported. Subscribers should not throw or mutate the editor during notification.

Group related changes in one `edit` callback for one undo step. For interactive drags, keep a draft in your host UI and commit on pointer-up; the library does not install pointer or keyboard listeners.

## Browser embed with your own SVG

Use this in an application compiled by a bundler. The host HTML supplies an SVG `<path id="preview-path">` and buttons with IDs `translate` and `undo`:

```ts
import { createPathEditor } from '@bookklik/svg-path-studio/headless';

const editor = createPathEditor({ path: 'M2 2 L8 8' });
const preview = document.querySelector<SVGPathElement>('#preview-path')!;
const translate = document.querySelector<HTMLButtonElement>('#translate')!;
const undo = document.querySelector<HTMLButtonElement>('#undo')!;

function render() {
  const state = editor.getSnapshot();
  preview.setAttribute('d', state.path);
  undo.disabled = !state.canUndo;
}
const move = () => editor.edit((path) => path.translate(1, 0));
const undoEdit = () => editor.undo();
const unsubscribe = editor.subscribe(render);
translate.addEventListener('click', move);
undo.addEventListener('click', undoEdit);
render();

function dispose() {
  translate.removeEventListener('click', move);
  undo.removeEventListener('click', undoEdit);
  unsubscribe();
  editor.destroy();
}
```

Set SVG attributes rather than interpolating untrusted markup. The package never reads localStorage or registers global listeners. Create one editor per component/request. React hosts can pass `editor.subscribe` and `editor.getSnapshot` to `useSyncExternalStore`; for server rendering, also supply a server snapshot that matches the initial client state.

## Stateless engine

```ts
import { SpsPath, reversePath, optimizePath, SpsParseError } from '@bookklik/svg-path-studio';

const path = new SpsPath('M0 0 L10 10');
path.scale(2, 2);
path.setRelative(true);
reversePath(path);
optimizePath(path, { useHorizontalAndVerticalLines: true });
console.log(path.asString(4, true));
```

Invalid SVG path input throws `SpsParseError` with an `index` and `reason`. For an empty stateless path, use `new SpsPath()` rather than `new SpsPath('')`.

MIT licensed. See LICENSE in this package.
