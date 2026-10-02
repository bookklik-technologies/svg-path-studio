/**
 * Canvas renderer: builds the layered SVG once, reconciles on each state
 * change. Layers bottom-up: grid, ticks, reference image, ghost, main path,
 * hover highlight, handles, selection ring.
 */

import type { EditorState, Store, ViewBox } from '../state/store.js';
import { icon } from '../ui/icons.js';
import { openCommandMenu } from '../ui/menu.js';
import { SpsCommand, SpsPath } from '@svg-path-studio/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export class Renderer {
  private root: SVGSVGElement;
  private gGrid: SVGGElement;
  private gTicks: SVGGElement;
  private gImage: SVGGElement;
  private gGhost: SVGGElement;
  private gPath: SVGGElement;
  private gHighlight: SVGGElement;
  private gHandles: SVGGElement;
  private gSelection: SVGGElement;
  private unsubscribe: () => void;
  private raf = 0;
  private host: HTMLElement;
  private resizeObserver: ResizeObserver;
  private pointMenuButton: HTMLButtonElement;

  constructor(private store: Store, host: HTMLElement) {
    this.host = host;
    this.root = el('svg', { class: 'sps-canvas', 'data-sps': 'canvas', 'aria-label': 'SVG path editing canvas', tabindex: 0 });
    this.gGrid = el('g');
    this.gTicks = el('g');
    this.gImage = el('g');
    this.gGhost = el('g');
    this.gPath = el('g');
    this.gHighlight = el('g');
    this.gHandles = el('g');
    this.gSelection = el('g');
    this.gSelection.setAttribute('pointer-events', 'none');
    this.gTicks.setAttribute('pointer-events', 'none');
    for (const g of [this.gGrid, this.gTicks, this.gImage, this.gGhost, this.gPath, this.gHighlight, this.gHandles, this.gSelection]) {
      this.root.appendChild(g);
    }
    host.appendChild(this.root);
    this.pointMenuButton = document.createElement('button');
    this.pointMenuButton.type = 'button';
    this.pointMenuButton.className = 'sps-point-menu';
    this.pointMenuButton.dataset.sps = 'point-menu';
    this.pointMenuButton.hidden = true;
    this.pointMenuButton.title = 'Command actions';
    this.pointMenuButton.setAttribute('aria-label', 'Selected point actions');
    this.pointMenuButton.setAttribute('aria-haspopup', 'menu');
    this.pointMenuButton.innerHTML = icon('more');
    this.pointMenuButton.addEventListener('click', () => {
      const cmd = this.store.state.selection;
      if (!cmd) return;
      const r = this.pointMenuButton.getBoundingClientRect();
      openCommandMenu(this.store, this, cmd, r.left, r.bottom + 6);
    });
    host.appendChild(this.pointMenuButton);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this.root);

    this.unsubscribe = store.subscribe(() => {
      if (!this.raf) {
        this.raf = requestAnimationFrame(() => {
          this.raf = 0;
          this.render();
        });
      }
    });
    this.render();
  }

  destroy(): void {
    this.unsubscribe();
    this.resizeObserver.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.root.remove();
    this.pointMenuButton.remove();
  }

  /** Expand the view to fill the screen without stretching SVG coordinates. */
  viewport(state: EditorState): ViewBox {
    const vb = state.viewBox;
    const r = this.root.getBoundingClientRect();
    if (!r.width || !r.height) return { ...vb };
    const scale = Math.min(r.width / vb.width, r.height / vb.height);
    const width = r.width / scale;
    const height = r.height / scale;
    return { x: vb.x - (width - vb.width) / 2, y: vb.y - (height - vb.height) / 2, width, height };
  }

  /** Screen px per unit, including the SVG's aspect-ratio adjustment. */
  scaleTo(state: EditorState): { sx: number; sy: number } {
    const r = this.root.getBoundingClientRect();
    const vb = this.viewport(state);
    return { sx: r.width / vb.width, sy: r.height / vb.height };
  }

  toCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const state = this.store.state;
    const vb = this.viewport(state);
    const r = this.root.getBoundingClientRect();
    return {
      x: vb.x + ((clientX - r.left) / r.width) * vb.width,
      y: vb.y + ((clientY - r.top) / r.height) * vb.height
    };
  }

  render(): void {
    const state = this.store.state;
    if (!this.root.clientWidth || !this.root.clientHeight) return;
    const vb = this.viewport(state);

    this.root.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
    this.host.classList.toggle('sps-inserting', !!state.insertion);

    this.renderGrid(state);
    this.renderImage(state);
    this.renderPaths(state);
    if (!state.settings.preview) {
      this.renderHandles(state);
      this.renderSelection(state);
    } else {
      this.gHandles.replaceChildren();
      this.gSelection.replaceChildren();
      this.gHighlight.replaceChildren();
      this.pointMenuButton.hidden = true;
    }
  }

  private renderGrid(state: EditorState): void {
    const g = this.gGrid;
    g.replaceChildren();
    const vb = this.viewport(state);
    const { sx } = this.scaleTo(state);

    const step = this.gridStep(state);

    // minor lines
    const x0 = Math.floor(vb.x / step) * step;
    const y0 = Math.floor(vb.y / step) * step;
    for (let x = x0; x <= vb.x + vb.width; x += step) {
      g.appendChild(el('line', { x1: x, y1: vb.y, x2: x, y2: vb.y + vb.height, stroke: 'var(--sps-grid-minor)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    }
    for (let y = y0; y <= vb.y + vb.height; y += step) {
      g.appendChild(el('line', { x1: vb.x, y1: y, x2: vb.x + vb.width, y2: y, stroke: 'var(--sps-grid-minor)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    }

    // major lines at 5× minor
    const major = step * 5;
    const mx0 = Math.floor(vb.x / major) * major;
    const my0 = Math.floor(vb.y / major) * major;
    for (let x = mx0; x <= vb.x + vb.width; x += major) {
      g.appendChild(el('line', { x1: x, y1: vb.y, x2: x, y2: vb.y + vb.height, stroke: 'var(--sps-grid-major)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    }
    for (let y = my0; y <= vb.y + vb.height; y += major) {
      g.appendChild(el('line', { x1: vb.x, y1: y, x2: vb.x + vb.width, y2: y, stroke: 'var(--sps-grid-major)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    }

    // axes
    g.appendChild(el('line', { x1: vb.x, y1: 0, x2: vb.x + vb.width, y2: 0, stroke: 'var(--sps-axis)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    g.appendChild(el('line', { x1: 0, y1: vb.y, x2: 0, y2: vb.y + vb.height, stroke: 'var(--sps-axis)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));

    const t = this.gTicks;
    t.replaceChildren();
    // ticks (ruler marks on axes)
    if (state.settings.ticks) {
      const tickH = 8 / sx;
      for (let x = x0; x <= vb.x + vb.width; x += step) {
        t.appendChild(el('line', { x1: x, y1: -tickH / 2, x2: x, y2: tickH / 2, stroke: 'var(--sps-axis)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
      }
      for (let y = y0; y <= vb.y + vb.height; y += step) {
        t.appendChild(el('line', { x1: -tickH / 2, y1: y, x2: tickH / 2, y2: y, stroke: 'var(--sps-axis)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
      }
    }
    if (state.settings.tickNumbers) {
      // Keep numbers readable in screen pixels and visible when an axis is offscreen.
      const labelX = Math.max(vb.x + 52 / sx, Math.min(0, vb.x + vb.width - 8 / sx));
      const labelY = Math.max(vb.y + 20 / sx, Math.min(0, vb.y + vb.height - 8 / sx));
      const label = (value: number, x: number, y: number): void => {
        const text = el('text', {
          x, y, fill: 'var(--sps-text-dim)', 'font-size': 11 / sx,
          'font-family': 'ui-monospace, monospace', 'text-anchor': 'end',
          stroke: 'var(--sps-canvas)', 'stroke-width': 3 / sx, 'paint-order': 'stroke'
        });
        text.textContent = String(Number(value.toPrecision(10)));
        t.appendChild(text);
      };
      for (let x = mx0; x <= vb.x + vb.width; x += major) {
        if (x < vb.x + 24 / sx) continue;
        label(x, x - 5 / sx, labelY - 6 / sx);
      }
      for (let y = my0; y <= vb.y + vb.height; y += major) {
        if (y < vb.y + 16 / sx || Math.abs(y) < major * 1e-8) continue;
        label(y, labelX - 6 / sx, y - 5 / sx);
      }
    }
  }

  gridStep(state: EditorState = this.store.state): number {
    const rawStep = 32 / this.scaleTo(state).sx;
    const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
    return [1, 2, 5, 10].map((m) => m * pow).find((c) => c >= rawStep) ?? pow * 10;
  }

  /** Use actual curve and arc bounds rather than treating arc radii as points. */
  fitToPath(): void {
    const path = el('path', { d: this.renderD(this.store.state) });
    this.gPath.appendChild(path);
    const bounds = path.getBBox();
    path.remove();
    if (!this.store.state.path.commands.length) return;
    const span = Math.max(bounds.width, bounds.height, 2);
    const pad = span * 0.2;
    this.store.update((s) => {
      s.viewBox = {
        x: bounds.x + bounds.width / 2 - Math.max(bounds.width, 2) / 2 - pad,
        y: bounds.y + bounds.height / 2 - Math.max(bounds.height, 2) / 2 - pad,
        width: Math.max(bounds.width, 2) + pad * 2,
        height: Math.max(bounds.height, 2) + pad * 2
      };
    });
  }

  private renderImage(state: EditorState): void {
    const g = this.gImage;
    g.replaceChildren();
    if (!state.referenceImage) return;
    const img = el('image', {
      href: state.referenceImage.url,
      x: state.viewBox.x,
      y: state.viewBox.y,
      width: state.viewBox.width,
      height: state.viewBox.height,
      preserveAspectRatio: 'xMidYMid meet',
      opacity: state.referenceImage.opacity
    });
    g.appendChild(img);
  }

  /** Build the path `d` for rendering (absolute form). */
  private renderD(state: EditorState): string {
    state.path.refreshAbsolutePositions();
    // Render with the ORIGINAL command types — but easiest correct approach:
    // serialize as-is; the browser interprets relative commands the same way.
    return state.path.asString(10, false);
  }

  private renderPaths(state: EditorState): void {
    const d = this.renderD(state);
    this.gPath.replaceChildren();
    if (d.trim()) {
      this.gPath.appendChild(
        el('path', {
          d,
          fill: state.settings.fill ? 'var(--sps-fill)' : 'none',
          stroke: 'var(--sps-path-stroke)',
          'stroke-width': 1.5 / this.scaleTo(state).sx,
          'data-sps': 'main-path'
        })
      );
    }
    this.gGhost.replaceChildren();
  }

  private renderHandles(state: EditorState): void {
    const g = this.gHandles;
    g.replaceChildren();
    state.path.refreshAbsolutePositions();
    const { sx } = this.scaleTo(state);
    const hs = 8 / sx; // handle size in canvas units

    for (const cmd of state.path.commands) {
      if (cmd.type === 'Z') continue;
      // endpoint handle (square)
      g.appendChild(
        el('rect', {
          x: cmd.absEnd.x - hs / 2,
          y: cmd.absEnd.y - hs / 2,
          width: hs,
          height: hs,
          fill: 'var(--sps-handle)',
          stroke: 'var(--sps-handle-stroke)',
          'stroke-width': 1.4 / sx,
          'data-sps': 'handle-end',
          'data-sps-cmd': String(cmd.id)
        })
      );
      // control handles (circles with stems)
      cmd.absControls.forEach((cp, ci) => {
        if (cmd.type === 'A') return; // radii cache, not a draggable point
        const isCp = cmd.type === 'C' || cmd.type === 'S' || cmd.type === 'Q';
        if (!isCp) return;
        g.appendChild(el('line', { x1: cmd.absStart.x, y1: cmd.absStart.y, x2: cp.x, y2: cp.y, stroke: 'var(--sps-ghost)', 'stroke-width': 0.8 / sx, 'stroke-dasharray': `${3 / sx} ${3 / sx}` }));
        g.appendChild(
          el('circle', {
            cx: cp.x,
            cy: cp.y,
            r: hs / 2.2,
            fill: 'var(--sps-handle)',
            stroke: 'var(--sps-handle-stroke)',
            'stroke-width': 1.2 / sx,
            'data-sps': 'handle-control',
            'data-sps-cmd': String(cmd.id),
            'data-sps-ci': String(ci)
          })
        );
      });
    }
  }

  private renderSelection(state: EditorState): void {
    const g = this.gSelection;
    g.replaceChildren();
    this.gHighlight.replaceChildren();
    const sel = state.selection;
    this.pointMenuButton.hidden = true;
    if (!sel || sel.type === 'Z' || !state.path.commands.includes(sel)) return;
    const { sx } = this.scaleTo(state);

    // ring around selected endpoint
    {
      const r = 7 / sx;
      g.appendChild(el('circle', { cx: sel.absEnd.x, cy: sel.absEnd.y, r, fill: 'none', stroke: 'var(--sps-selection)', 'stroke-width': 2 / sx, 'data-sps': 'selection' }));
    }

    // Place the HTML actions button beside the selected endpoint, inside the canvas.
    const vb = this.viewport(state);
    const r = this.root.getBoundingClientRect();
    const host = this.host.getBoundingClientRect();
    const px = (sel.absEnd.x - vb.x) * sx;
    const py = (sel.absEnd.y - vb.y) * sx;
    if (!state.drag && !state.insertion && px >= 0 && py >= 0 && px <= r.width && py <= r.height) {
      const x = px + 12 + 38 <= r.width ? px + 12 : px - 50;
      const y = py + 12 + 38 <= r.height ? py + 12 : py - 50;
      this.pointMenuButton.style.left = `${r.left - host.left + Math.max(4, x)}px`;
      this.pointMenuButton.style.top = `${r.top - host.top + Math.max(4, y)}px`;
      this.pointMenuButton.hidden = false;
    }
    if (sel.type !== 'M') {
      const segment = new SpsPath(`M ${sel.absStart.x} ${sel.absStart.y}`);
      let command = sel.clone();
      if (sel.type === 'S') {
        const [a, b] = sel.absControls;
        command = SpsCommand.make('C', false, [a.x, a.y, b.x, b.y, sel.absEnd.x, sel.absEnd.y]);
      } else if (sel.type === 'T') {
        const a = sel.absControls[0];
        command = SpsCommand.make('Q', false, [a.x, a.y, sel.absEnd.x, sel.absEnd.y]);
      }
      segment.commands.push(command);
      this.gHighlight.appendChild(el('path', {
        d: segment.asString(10, false), fill: 'none', stroke: 'var(--sps-selection)',
        'stroke-width': 2 / sx, 'pointer-events': 'none'
      }));
    }
  }
}
