# Headless editor

`createPathEditor` builds your own interface without loading SVG Path Studio's ribbon, styles, storage, clipboard handlers, keyboard shortcuts, or service worker.

Import it either way:

```ts
import { createPathEditor } from '@bookklik/svg-path-studio/headless';
import { createPathEditor } from '@bookklik/svg-path-studio'; // also re-exported
```

::: warning A controller, not a widget
This is a UI-independent controller, **not** an iframe or a prebuilt canvas embed. Your application owns rendering, pointer handling, selection, viewport, and accessibility. The package reads no `localStorage` and registers no global listeners.
:::

## Usage

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

## API contract

| Method | Behavior |
| --- | --- |
| `getSnapshot()` | Stable, frozen `{ path, commandCount, canUndo, canRedo }` until a change. Path text uses 15 decimal places with trailing zeros removed. |
| `getPath()` | Detached `SpsPath` copy with full numeric precision and refreshed geometry. Mutating it never changes the editor. |
| `subscribe(listener)` | Calls a no-argument listener synchronously after changes; returns unsubscribe. Does not call immediately. |
| `setPath(d)` | Replaces the path as one undoable edit. Empty/whitespace clears it. Invalid input throws, leaving state and history unchanged. |
| `edit(mutator)` | Gives a detached mutable path to a synchronous callback; commits the result as one undo step. Exceptions and invalid geometry abort the edit. |
| `undo()` / `redo()` | Restore geometry without rounding. No-op if unavailable. A new edit discards redo history. |
| `clearHistory()` | Clears undo/redo without changing geometry. |
| `destroy()` | Releases subscriptions and history. Idempotent; later writes/subscriptions throw. Read methods remain available. |

## Rules and defaults

- The initial path defaults to empty; `historyLimit` defaults to `200` — pass `0` to disable history. It must be a non-negative integer.
- Non-empty paths must begin with a moveto.
- Edits require valid command types and arities and **finite** coordinates.
- No-op edits do not notify subscribers and do not add history.
- Nested mutations and asynchronous `edit` callbacks are unsupported.
- Subscribers must not throw or mutate the editor during notification.

::: tip Committing drags
Group related changes in a single `edit` callback — each callback becomes **one undo step**. For interactive drags, keep a draft path in your host UI and commit the final geometry on pointer-up.
:::

## Browser embed with your own SVG

For an application compiled with a bundler, the host HTML supplies an SVG `<path id="preview-path">` and buttons with IDs `translate` and `undo`:

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

Set SVG **attributes** rather than interpolating untrusted markup.

## React integration

React hosts can pass `editor.subscribe` and `editor.getSnapshot` to `useSyncExternalStore`; for server rendering, also supply a server snapshot that matches the initial client state. Create **one editor per component/request**.
