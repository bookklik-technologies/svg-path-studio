# Getting started

SVG Path Studio is an online editor for creating and manipulating SVG path data. Everything runs client-side: paste a path, drag points, insert commands, apply transforms, optimize, and export.

**Open SVG Path Studio** → <https://bookklik-technologies.github.io/svg-path-studio/>

![SVG Path Studio preview](/preview.png)

## The repository is a pnpm monorepo

| Package | Purpose |
| --- | --- |
| [`packages/core`](https://github.com/bookklik-technologies/svg-path-studio/tree/main/packages/core) | `@bookklik/svg-path-studio` — zero-dependency path engine and headless editor. Usable standalone in Node or the browser. |
| [`packages/app`](https://github.com/bookklik-technologies/svg-path-studio/tree/main/packages/app) | The editor application — framework-free TypeScript + Vite. Private; not published. |

## Prerequisites

- Node.js **18+**
- pnpm with the version pinned in `package.json` (`packageManager` field)

## Running from source

```bash
pnpm install
pnpm -r build      # build core + app
pnpm -r test       # unit + property tests
pnpm dev           # editor at http://localhost:5173
```

> [!TIP]
> The app uses a relative asset base, so the production build works under a repository subpath, on `<owner>.github.io`, or on a custom domain without changing the Vite `base`.

## This documentation site

This site is built with VitePress from the `docs/` folder:

```bash
pnpm docs          # dev server
pnpm docs:build    # static build to docs/.vitepress/dist
pnpm docs:preview  # preview the production build
```

See [Deployment & publishing](/project/deployment) for GitHub Pages and npm publishing.

## Where to go next

- [Interactive canvas](/guide/canvas) — pointer, pan/zoom, and grid snapping behavior.
- [Insert commands](/guide/insert) — the `M l h v c s q t a z` palette and reference images.
- [Transforms & path tools](/guide/transform) — scale, translate, rotate, rounding, relative/absolute, reverse.
- [View, grid & viewBox](/guide/view) — navigation, viewBox fields, ruler and grid options, SVG output tuning.
- [Engine overview](/engine/overview) — using `@bookklik/svg-path-studio` as a library.
- [Headless editor](/engine/headless) — build your own UI on `createPathEditor`.
