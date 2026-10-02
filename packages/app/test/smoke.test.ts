import { describe, it, expect } from 'vitest';
import { Store, defaultState } from '../src/state/store.js';
import { reversePath, optimizePath } from '@svg-path-studio/core';

describe('app state wiring (headless smoke)', () => {
  it('store parses, tracks errors, and history round-trips', () => {
    const store = new Store();
    store.setPath('M 1 1 L 5 5 C 6 6 7 7 8 8');
    expect(store.state.parseError).toBeNull();
    expect(store.state.path.commands.length).toBe(3);

    store.setPath('M 1 1 L oops');
    expect(store.state.parseError).not.toBeNull();
    expect(store.state.path.asString(4)).toBe('M 1 1 L 5 5 C 6 6 7 7 8 8');

    store.undo();
    expect(store.state.parseError).toBeNull();
  });

  it('gesture-based undo captures drag edits', () => {
    const store = new Store();
    const before = store.state.path.asString(10);
    store.beginGesture();
    const cmd = store.state.path.commands[1]!;
    cmd.values[0] = 9;
    cmd.values[1] = 3;
    store.state.path.refreshAbsolutePositions();
    store.endGesture();
    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(store.state.path.asString(10)).toBe(before);
  });

  it('engine operations driven the way the UI drives them', () => {
    const store = new Store();
    store.update((s) => {
      s.path.scale(2, 2);
      s.path.translate(1, 1);
      s.path.setRelative(true);
      s.path.refreshAbsolutePositions();
    });
    expect(store.state.path.commands[1]!.letter).toBe('l');
    void reversePath;
    void optimizePath;
  });

  it('default state parses', () => {
    const s = defaultState();
    expect(s.path.commands[0]!.type).toBe('M');
    expect(s.settings.theme).toBe('dark');
  });
});
