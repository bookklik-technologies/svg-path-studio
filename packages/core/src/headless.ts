import { SpsPath } from './path.js';
import { COMMAND_ARITY } from './types.js';

export interface PathEditorOptions {
  path?: string;
  historyLimit?: number;
}

export interface PathEditorSnapshot {
  readonly path: string;
  readonly commandCount: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface PathEditor {
  getSnapshot(): PathEditorSnapshot;
  getPath(): SpsPath;
  subscribe(listener: () => void): () => void;
  setPath(path: string): void;
  edit(mutator: (path: SpsPath) => unknown): void;
  undo(): void;
  redo(): void;
  clearHistory(): void;
  destroy(): void;
}

function clonePath(path: SpsPath): SpsPath {
  const clone = new SpsPath();
  clone.commands = path.commands.map((command) => command.clone());
  clone.refreshAbsolutePositions();
  return clone;
}

function pathKey(path: SpsPath): string {
  return JSON.stringify(path.commands.map(({ type, relative, values, largeArc, sweep }) =>
    [type, relative, values, largeArc, sweep]));
}

function validatePath(path: SpsPath): void {
  if (path.commands.length && path.commands[0].type !== 'M') {
    throw new Error('A non-empty path must start with a moveto command');
  }
  for (const command of path.commands) {
    if (!Object.hasOwn(COMMAND_ARITY, command.type) || command.values.length !== COMMAND_ARITY[command.type] ||
      !command.values.every(Number.isFinite)) {
      throw new Error('Path commands must have a valid type, arity and finite coordinates');
    }
  }
}

export function createPathEditor(options: PathEditorOptions = {}): PathEditor {
  const historyLimit = options.historyLimit ?? 200;
  if (!Number.isInteger(historyLimit) || historyLimit < 0) {
    throw new RangeError('historyLimit must be a non-negative integer');
  }
  const parse = (value: string): SpsPath => value.trim() ? new SpsPath(value) : new SpsPath();
  let path = parse(options.path ?? '');
  validatePath(path);
  const undoStack: SpsPath[] = [];
  const redoStack: SpsPath[] = [];
  const listeners = new Set<() => void>();
  let destroyed = false;
  let editing = false;
  const snapshot = (): PathEditorSnapshot => Object.freeze({
    path: path.asString(15, false),
    commandCount: path.commands.length,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  });
  let currentSnapshot = snapshot();

  const assertWritable = (): void => {
    if (destroyed) throw new Error('Path editor has been destroyed');
    if (editing) throw new Error('Nested editor mutations are not supported');
  };
  const emit = (): void => {
    currentSnapshot = snapshot();
    for (const listener of [...listeners]) listener();
  };
  const commit = (next: SpsPath): void => {
    validatePath(next);
    if (pathKey(next) === pathKey(path)) return;
    const committed = clonePath(next);
    if (historyLimit > 0) {
      undoStack.push(path);
      if (undoStack.length > historyLimit) undoStack.shift();
    }
    path = committed;
    redoStack.length = 0;
    emit();
  };

  return {
    getSnapshot: () => currentSnapshot,
    getPath: () => clonePath(path),
    subscribe(listener) {
      if (destroyed) throw new Error('Path editor has been destroyed');
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setPath(value) {
      assertWritable();
      commit(parse(value));
    },
    edit(mutator) {
      assertWritable();
      const draft = clonePath(path);
      editing = true;
      try {
        const result = mutator(draft);
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          throw new TypeError('Path edits must be synchronous');
        }
      } finally {
        editing = false;
      }
      commit(draft);
    },
    undo() {
      assertWritable();
      const previous = undoStack.pop();
      if (!previous) return;
      redoStack.push(path);
      path = previous;
      emit();
    },
    redo() {
      assertWritable();
      const next = redoStack.pop();
      if (!next) return;
      undoStack.push(path);
      path = next;
      emit();
    },
    clearHistory() {
      assertWritable();
      if (!undoStack.length && !redoStack.length) return;
      undoStack.length = 0;
      redoStack.length = 0;
      emit();
    },
    destroy() {
      if (destroyed) return;
      assertWritable();
      destroyed = true;
      listeners.clear();
      undoStack.length = 0;
      redoStack.length = 0;
      currentSnapshot = snapshot();
    }
  };
}
