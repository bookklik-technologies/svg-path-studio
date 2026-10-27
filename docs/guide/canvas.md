# Interactive canvas

The canvas is the primary editing surface. Everything is rendered client-side with no server interaction.

## Points and handles

- Drag **endpoints** to move them.
- Drag **bézier control handles** to reshape curvilinear commands (`C`, `S`, `Q`, `T`, and the arc representation).
- Selecting a command row in the command panel highlights its geometry on the canvas.

## Grid snapping

- Points snap to the grid while dragging.
- Hold <kbd>Ctrl</kbd> to bypass snapping temporarily.

## Navigation

- **Pan** by dragging on empty canvas space.
- **Zoom** with the mouse wheel or the View tab's zoom in / out / reset controls.
- **Fit path** (View tab) frames the whole path in the viewport — see [View, grid & viewBox](/guide/view).

::: tip Keyboard shortcuts
`m l v h c s q t a z` insert a command at the selection, `Shift` + the same key converts the selection, <kbd>Esc</kbd> cancels an in-progress operation and <kbd>Del</kbd> deletes it. See [Keyboard shortcuts](/guide/keyboard-shortcuts).
:::

## Selection model

Edits are atomic and undoable: the picker's undo/redo (<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>) restores full precision geometry without rounding, so repeated round-trip edits do not accumulate errors.

Sessions persist locally, work offline through the service worker, and the whole session — viewBox, commands, settings — can be encoded into a [shareable URL](/guide/export-and-share).
