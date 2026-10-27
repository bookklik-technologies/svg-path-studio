import { describe, expect, it } from 'vitest';
import { createPathEditor, SpsPath, SpsParseError } from '../src/index.js';

describe('headless editor', () => {
  it('starts empty with a stable, frozen snapshot', () => {
    const editor = createPathEditor();
    expect(editor.getSnapshot()).toEqual({ path: '', commandCount: 0, canUndo: false, canRedo: false });
    expect(editor.getSnapshot()).toBe(editor.getSnapshot());
    expect(Object.isFrozen(editor.getSnapshot())).toBe(true);
  });

  it('notifies once per edit and supports unsubscribe and no-op edits', () => {
    const editor = createPathEditor({ path: 'M0 0 L1 1' });
    let calls = 0;
    const unsubscribe = editor.subscribe(() => { calls++; });
    editor.edit((path) => path.translate(2, 3));
    expect(editor.getSnapshot().path).toBe('M 2 3 L 3 4');
    editor.setPath('M2 3L3 4');
    editor.edit(() => {});
    expect(calls).toBe(1);
    unsubscribe();
    editor.undo();
    expect(calls).toBe(1);
  });

  it('rolls back invalid input and failed mutations without changing history', () => {
    const editor = createPathEditor({ path: 'M0 0' });
    const before = editor.getSnapshot();
    expect(() => editor.setPath('M bad')).toThrow(SpsParseError);
    expect(() => editor.edit((path) => {
      path.translate(3, 4);
      throw new Error('cancel');
    })).toThrow('cancel');
    expect(() => editor.edit((path) => { path.commands[0].values[0] = Infinity; })).toThrow('finite');
    expect(editor.getSnapshot()).toBe(before);
  });

  it('isolates returned paths and retained mutation drafts', () => {
    const editor = createPathEditor({ path: 'M0 0' });
    editor.getPath().translate(20, 20);
    let retained = new SpsPath();
    editor.edit((path) => {
      retained = path;
      path.translate(1, 2);
    });
    retained.translate(20, 20);
    expect(editor.getSnapshot().path).toBe('M 1 2');
    expect(editor.getPath().asString()).toBe('M 1 2');
  });

  it('supports bounded undo/redo and invalidates redo on new edits', () => {
    const editor = createPathEditor({ path: 'M0 0', historyLimit: 1 });
    editor.setPath('M1 1');
    editor.setPath('M2 2');
    editor.undo();
    editor.undo();
    expect(editor.getSnapshot().path).toBe('M 1 1');
    editor.redo();
    expect(editor.getSnapshot().path).toBe('M 2 2');
    editor.undo();
    editor.setPath('M3 3');
    expect(editor.getSnapshot().canRedo).toBe(false);
    editor.clearHistory();
    expect(editor.getSnapshot().canUndo).toBe(false);
  });

  it('supports clearing the path and disabling history', () => {
    const editor = createPathEditor({ path: 'M0 0', historyLimit: 0 });
    editor.setPath('  ');
    editor.undo();
    expect(editor.getSnapshot().path).toBe('');
    expect(editor.getSnapshot().canUndo).toBe(false);
  });

  it('preserves full coordinate precision in history', () => {
    const editor = createPathEditor({ path: 'M0.12345678901234567 0' });
    const original = editor.getPath().commands[0].values[0];
    editor.setPath('M1 1');
    editor.undo();
    expect(editor.getPath().commands[0].values[0]).toBe(original);
  });

  it('refreshes geometry after direct coordinate edits', () => {
    const editor = createPathEditor({ path: 'M0 0L1 1' });
    editor.edit((path) => { path.commands[1].values = [5, 6]; });
    expect(editor.getPath().commands[1].absEnd).toEqual({ x: 5, y: 6 });
  });

  it('rejects invalid history limits, malformed commands and nested edits', () => {
    for (const historyLimit of [-1, 0.5, Infinity]) {
      expect(() => createPathEditor({ historyLimit })).toThrow(RangeError);
    }
    const editor = createPathEditor({ path: 'M0 0L1 1' });
    expect(() => editor.edit((path) => { path.commands.shift(); })).toThrow('moveto');
    expect(() => editor.edit((path) => { path.commands[0].values = []; })).toThrow('arity');
    expect(() => editor.edit(() => editor.undo())).toThrow('Nested');
    expect(() => editor.edit(() => Promise.resolve())).toThrow('synchronous');
    expect(editor.getSnapshot().path).toBe('M 0 0 L 1 1');
  });

  it('releases listeners and history on destroy and rejects further writes', () => {
    const editor = createPathEditor();
    editor.setPath('M0 0');
    editor.destroy();
    editor.destroy();
    expect(editor.getSnapshot().canUndo).toBe(false);
    expect(() => editor.setPath('M1 1')).toThrow('destroyed');
    expect(() => editor.subscribe(() => {})).toThrow('destroyed');
  });
});
