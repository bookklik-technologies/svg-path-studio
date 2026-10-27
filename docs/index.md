---
layout: home

hero:
  name: SVG Path Studio
  text: Edit SVG paths with precision
  tagline: >-
    In your browser, no framework attached. Paste a path, drag points and
    bézier handles on an interactive canvas, insert commands, apply transforms,
    optimize the output — all client-side.
  image:
    src: /logo.svg
    alt: SVG Path Studio logo
  actions:
    - theme: brand
      text: Open SVG Path Studio
      link: https://bookklik-technologies.github.io/svg-path-studio/
    - theme: alt
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Headless engine
      link: /engine/overview

features:
  - title: Interactive canvas
    details: Drag endpoints and bézier control handles, snap to the grid (hold Ctrl to bypass), pan by drag, and zoom with the wheel or the toolbar.
    icon: 🎯
  - title: Command panel
    details: One row per path command. Toggle relative/absolute with the type chip, and use the per-row menu to insert, convert, reverse subpaths, or delete.
    icon: 🧭
  - title: Path operations
    details: Scale, translate, rotate, round coordinates, convert to relative/absolute, reverse, and a 7-flag optimizer with deterministic, default-off passes.
    icon: 🔧
  - title: ViewBox tools
    details: Manual X/Y/width/height with aspect lock, zoom in/out/reset, fit to path, grid and rulers with snapping, ticks, and numbers.
    icon: 📐
  - title: I/O & sharing
    details: Open/save path files, import SVG, export with style plus live preview, copy to clipboard, and shareable URLs that encode the whole session.
    icon: 🔗
  - title: Headless engine
    details: The zero-dependency @bookklik/svg-path-studio package ships the path engine and a headless editor with subscriptions, atomic edits, and undo/redo.
    icon: ⚙️
---
