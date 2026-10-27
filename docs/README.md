# SVG Path Studio — documentation site

This folder is a [VitePress](https://vitepress.dev) documentation site for SVG Path Studio.

- `index.md` — the landing/home page
- `guide/` — the editor reference (canvas, ribbon tabs, export, shortcuts)
- `engine/` — the `@bookklik/svg-path-studio` package (path engine, optimizer, headless editor)
- `project/` — GitHub Pages and npm publishing
- `.vitepress/config.mts` — theme config (nav, sidebar, local search)

## Commands

From the **repository root** (VitePress is a root dev dependency; `pnpm install` once first):

```bash
pnpm docs          # dev server with hot reload
pnpm docs:build    # static build to docs/.vitepress/dist
pnpm docs:preview  # preview the production build
```

## Deployment notes

For GitHub Pages under a repository subpath, set the `base` option in `.vitepress/config.mts` (the line is already present as a comment). The complete deployment guide lives at [Deployment & publishing](./project/deployment.md).
