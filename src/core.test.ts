import { describe, expect, it } from 'vitest';
import { Vector2D } from './core';

describe('Vector2D', () => {
  it('compares coordinates by value', () => {
    expect(new Vector2D(3, 7).equals(new Vector2D(3, 7))).toBe(true);
    expect(new Vector2D(3, 7).equals(new Vector2D(7, 3))).toBe(false);
  });

  it('copies without sharing identity', () => {
    const original = new Vector2D(5, 9);
    const copy = original.copy();
    copy.x = 99;

    expect(copy).not.toBe(original);
    expect(original).toEqual({ x: 5, y: 9 });
  });
});
