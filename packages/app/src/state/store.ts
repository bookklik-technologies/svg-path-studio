/**
 * Editor state store — plain objects, centralized dispatch, undo/redo history.
 * Framework-free: mutations flow through dispatch(); subscribers are notified
 * via a tiny emitter with rAF batching done by the renderer.
 */

import { SpsPath, SpsParseError } from '@svg-path-studio/core';
import type { SpsCommand } from '@svg-path-studio/core';

export type Theme = 'dark' | 'light';

export interface EditorSettings {
  snap: boolean;
  fill: boolean;
  preview: boolean;
  ticks: boolean;
  tickNumbers: boolean;
  commandsSidebar: boolean;
  minify: boolean;
  precision: number;
  theme: Theme;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type InsertionType = 'M' | 'L' | 'V' | 'H' | 'C' | 'S' | 'Q' | 'T' | 'A' | null;

export interface EditorState {
  path: SpsPath;
  parseError: SpsParseError | null;
  viewBox: ViewBox;
  /** Aspect-lock for viewBox editing. */
  lockAspect: boolean;
  settings: EditorSettings;
  /** Currently selected command (SpsCommand identity). */
  selection: SpsCommand | null;
  /** Pending insertion: user picked a type, waiting for canvas click. */
  insertion: { type: InsertionType } | null;
  /** Live drag: in-flight command values (not yet an undo entry). */
  drag: { cmd: SpsCommand; kind: 'end' | 'control'; controlIndex?: number } | null;
  referenceImage: { url: string; opacity: number } | null;
  optimizeOptions: {
    removeUselessCommands: boolean;
    useShorthands: boolean;
    useHorizontalAndVerticalLines: boolean;
    useRelativeAbsolute: boolean;
    useReverse: boolean;
    removeOrphanDots: boolean;
    useClosePath: boolean;
  };
}

export interface HistoryEntry {
  pathBefore: string;
  viewBefore: ViewBox;
  pathAfter: string;
  viewAfter: ViewBox;
}

type Listener = (state: EditorState) => void;

export function defaultState(): EditorState {
  return {
    path: new SpsPath('M 1 1 L 9 9'),
    parseError: null,
    viewBox: { x: -1, y: -1, width: 15, height: 15 },
    lockAspect: false,
    settings: {
      snap: true,
      fill: true,
      preview: false,
      ticks: false,
      tickNumbers: false,
      commandsSidebar: true,
      minify: false,
      precision: 3,
      theme: 'dark'
    },
    selection: null,
    insertion: null,
    drag: null,
    referenceImage: null,
    optimizeOptions: {
      removeUselessCommands: false,
      useShorthands: false,
      useHorizontalAndVerticalLines: false,
      useRelativeAbsolute: false,
      useReverse: false,
      removeOrphanDots: false,
      useClosePath: false
    }
  };
}

export class Store {
  state: EditorState;
  private listeners = new Set<Listener>();
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  constructor(state: EditorState = defaultState()) {
    this.state = state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  /** Begin a user gesture: snapshot the current path for undo. */
  beginGesture(): void {
    this.gestureBefore = { path: this.state.path.asString(10, false), view: { ...this.state.viewBox } };
  }

  private gestureBefore: { path: string; view: ViewBox } | null = null;

  /** Complete a gesture: push an undo entry if anything changed. */
  endGesture(): void {
    if (!this.gestureBefore) return;
    const after = { path: this.state.path.asString(10, false), view: { ...this.state.viewBox } };
    if (after.path !== this.gestureBefore.path || after.view.x !== this.gestureBefore.view.x || after.view.y !== this.gestureBefore.view.y || after.view.width !== this.gestureBefore.view.width || after.view.height !== this.gestureBefore.view.height) {
      this.undoStack.push({
        pathBefore: this.gestureBefore.path,
        viewBefore: this.gestureBefore.view,
        pathAfter: after.path,
        viewAfter: after.view
      });
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = [];
    }
    this.gestureBefore = null;
    // Refresh history controls after the undo entry has been committed.
    this.emit();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const entry = this.undoStack.pop();
    if (!entry) return;
    this.redoStack.push(entry);
    this.restore(entry.pathBefore, entry.viewBefore);
  }

  redo(): void {
    const entry = this.redoStack.pop();
    if (!entry) return;
    this.undoStack.push(entry);
    this.restore(entry.pathAfter, entry.viewAfter);
  }

  private restore(d: string, view: ViewBox): void {
    try {
      this.state.path = new SpsPath(d);
      this.state.parseError = null;
    } catch {
      /* snapshot is always valid */
    }
    this.state.viewBox = { ...view };
    if (this.state.selection && !this.state.path.commands.includes(this.state.selection)) {
      this.state.selection = null;
    }
    this.emit();
  }

  /** Apply a mutation to the state, then notify. */
  update(mutator: (s: EditorState) => void): void {
    mutator(this.state);
    this.emit();
  }

  /** Replace the path wholesale (typed input). */
  setPath(d: string): void {
    this.beginGesture();
    try {
      const p = new SpsPath(d);
      this.state.path = p;
      this.state.parseError = null;
      this.state.selection = null;
      this.state.insertion = null;
    } catch (e) {
      if (e instanceof SpsParseError) {
        this.state.parseError = e; // canvas keeps last good path
      } else {
        throw e;
      }
    }
    this.endGesture();
    this.emit();
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
