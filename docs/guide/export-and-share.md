# Export & share

Everything the studio produces stays on your device.

## Export SVG

The **Export SVG** dialog produces a full `<svg>`:

- **Style options** — choose presentation attributes (fill, stroke) applied to the path.
- **Live preview** — see the rendered result before copying/saving.
- **Output options** — the [View tab's](/guide/view#svg-output) **minify** and **precision** settings control whitespace and the number of stored decimals in the `d` attribute.

## Clipboard and files

- **Copy path** — copy just the `d` string.
- **Save path** — write the path document to a `.path` file; **Open path** reads it back.
- **SVG import** — pull an existing path out of an SVG file.

## Share URLs

**Share** produces a URL that **encodes the entire session** — path, viewBox, and display settings. Opening that URL on another device or browser restores the full state. Nothing is uploaded; the whole session lives in the URL fragment, which is why it even works offline.

## Sessions and offline

- The session persists locally, so a refresh loses nothing.
- A **service worker** keeps the app available offline — once loaded, no network is needed and is never contacted.

::: warning No host features
Hosting, accounts, cloud storage, and permanent share links are not provided by the app itself. Everything is local; the share URL is the whole exchange mechanism.
:::
