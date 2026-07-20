import { describe, it, expect } from 'vitest';
import { isTextEntryTarget, isArrowKeyTarget } from './keyboard';

function input(type: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  return el;
}

describe('keyboard target guards', () => {
  it('treats text-like inputs as text-entry (both guards bail)', () => {
    for (const type of ['text', 'search', 'email', 'number', 'password']) {
      const el = input(type);
      expect(isTextEntryTarget(el)).toBe(true);
      expect(isArrowKeyTarget(el)).toBe(true);
    }
  });

  it('treats textarea, select, contenteditable as text-entry', () => {
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';

    for (const el of [textarea, select, editable]) {
      expect(isTextEntryTarget(el)).toBe(true);
      expect(isArrowKeyTarget(el)).toBe(true);
    }
  });

  it('lets digit shortcuts through a range slider but blocks arrows', () => {
    // The core reason for the split: the slice slider consumes arrows natively
    // (must not double-fire) but never consumes digit keys (presets must work).
    const range = input('range');
    expect(isTextEntryTarget(range)).toBe(false);
    expect(isArrowKeyTarget(range)).toBe(true);
  });

  it('lets both shortcuts through non-typing elements', () => {
    const canvas = document.createElement('canvas');
    const div = document.createElement('div');
    const button = document.createElement('button');

    for (const el of [canvas, div, button]) {
      expect(isTextEntryTarget(el)).toBe(false);
      expect(isArrowKeyTarget(el)).toBe(false);
    }
  });

  it('returns false for null / non-element targets', () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isArrowKeyTarget(null)).toBe(false);
  });
});
