# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users: web developers and designers who need to create or adjust SVG path data (icons, illustrations, UI assets) directly in the browser, typically pasting a path from another tool, dragging points/handles, transforming and optimizing it, then copying or exporting the result. Situations are quick, single-session editing tasks rather than long-form illustration work.

## Product Purpose

SVG Path Studio is an online editor for SVG path data: paste a path, drag endpoints and bézier control handles on an interactive canvas, insert/convert commands, apply transforms, round coordinates, optimize flags, and export/copy the result — all client-side. Success is a precise edit done faster than opening a full design tool, with trustworthy output.

## Positioning

Confirmed durable claim: precision path editing that runs entirely in the browser — no framework attached. A neighboring product could not truthfully copy the combination of full precision editing, a zero-dependency path engine (packages/core), and zero install/signup/backend friction.

## Operating Context

- Deployed to GitHub Pages (bookklik-technologies/svg-path-studio) with relative asset and service-worker URLs so the same build works on a repository subpath, `<owner>.github.io`, or a custom domain.
- Loaded in a browser; deep links and share URLs encode the whole session.
- Shortcuts are part of the daily workflow: `m l v h c s q t a z` insert commands, `Shift`+same converts, `Esc` cancels, `Del` deletes, `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo, `Ctrl` bypasses grid snap.

## Capabilities and Constraints

- Monorepo: `packages/core` (`@bookklik/svg-path-studio`, zero-dependency path engine: parser, serializer, transforms, conversions, reverse, optimize; standalone in Node or browser; invalid input throws `SpsParseError` with exact index and reason) and `packages/app` (framework-free TypeScript + Vite editor).
- Interactive canvas: drag endpoints and control handles, snap to grid, pan by drag, wheel/toolbar zoom.
- Command panel: one row per command; type chip toggles relative (orange) / absolute (violet); per-row menu (insert after, convert to, start path/subpath, reverse subpath, delete).
- Path operations: scale, translate, rotate, round coordinates, relative/absolute conversion, reverse, 7-flag optimizer (shorthand promotion, H/V lines, shortest relative/absolute form, reverse-if-shorter, and more).
- ViewBox tools: manual X/Y/width/height with aspect lock, zoom in/out/reset, fit to path.
- I/O: open/save path files, SVG import, SVG export with style + live preview, clipboard copy, shareable session URLs.
- Sessions persist locally; offline via service worker; dark/light themes.
- Binding constraint (user-confirmed): stays framework-free vanilla TypeScript + Vite; packages/core stays zero-dependency.

## Brand Commitments

- Name: SVG Path Studio.
- License: MIT.
- Tagline voice: "Edit SVG paths with precision — in your browser, no framework attached."

## Evidence on Hand

- README.md with feature list, core usage examples, and deploy workflow (repository root).
- preview.png and logo.svg / icon.svg at the repository root.
- Live deployed instance: https://bookklik-technologies.github.io/svg-path-studio/
- Installed visual implementation exists in `packages/app` (incumbent design authority for refinement; no DESIGN.md yet).
