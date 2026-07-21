import type { LegacyNeonSnake } from '../types';
import { Food } from './Food';
import { Hazard } from './Hazard';
import { PowerUp } from './PowerUp';
import { Snake } from './Snake';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

export { Food, Hazard, PowerUp, Snake };

const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
NS.PowerUp = PowerUp;
NS.Food = Food;
NS.Hazard = Hazard;
NS.Snake = Snake;
