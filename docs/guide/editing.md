# Editing paths (Home)

The **Home** ribbon tab collects file operations, clipboard actions, and the path data editor.

## Open, save, and copy

- **Open path** — load a `.path` document or paste path data into the editor.
- **Save path** — download the current path as a local file.
- **Copy path** — copy the path string to the clipboard.
- **Clear** — remove the current path.

## Path data field

The **path data textarea** is bidirectional: it shows the live, canonical serialization of the path and accepts pasted or typed edits.

- A live **character count** helps you watch path size.
- Invalid input is reported inline with a **parse error display**, including position and reason if supplied by the engine (<code>SpsParseError</code>).

Separate SVG markup and SVG export flow are covered in [Export & share](/guide/export-and-share).

## Add point

**Add point** appends a new point to the current path from the toolbar instead of inserting a specific command type — use the [Insert tab](/guide/insert) when you need control over the command type.

## Dialogs

- **Export SVG** — style options with a live preview; see [Export & share](/guide/export-and-share).
- **Share** — produce a URL encoding the whole session.
- **About** — version and license information.
