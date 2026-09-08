import './orbit/main'
import type { LegacyNeonSnake } from './types'

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>
  }
}
