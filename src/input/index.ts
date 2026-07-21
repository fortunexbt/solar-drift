import type { LegacyNeonSnake } from '../types';
import { InputManager } from './InputManager';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

export { InputManager };

const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
NS.InputManager = InputManager;
