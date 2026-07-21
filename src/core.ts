import type { LegacyNeonSnake } from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

export class Vector2D {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  equals(other: Vector2D): boolean {
    return this.x === other.x && this.y === other.y;
  }

  copy(): Vector2D {
    return new Vector2D(this.x, this.y);
  }
}

if (typeof window !== 'undefined') {
  const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
  NS.Vector2D = Vector2D;
}
