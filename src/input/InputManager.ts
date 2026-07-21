import { Vector2D } from '../core';

type InputHandlers = {
  onDirection: (direction: Vector2D) => void;
  onTogglePause: () => void;
  onSurge: () => void;
  onToggleFps: () => void;
  onToggleSound: () => void;
};

export class InputManager {
  private canvas: HTMLCanvasElement;
  private handlers: InputHandlers;
  private isEnabled: boolean;
  private isPaused: boolean;
  private touchStartX: number;
  private touchStartY: number;
  private touchHandled: boolean;
  private readonly touchThreshold: number;
  private readonly directions: Record<string, Vector2D>;

  constructor(canvas: HTMLCanvasElement, handlers: InputHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.isEnabled = false;
    this.isPaused = false;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchHandled = false;
    this.touchThreshold = 18;
    this.directions = {
      up: new Vector2D(0, -1),
      down: new Vector2D(0, 1),
      left: new Vector2D(-1, 0),
      right: new Vector2D(1, 0)
    };
    this.bindListeners();
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  private bindListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (!this.isEnabled) return;
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (this.isPaused && e.key !== 'Escape' && e.key !== ' ') return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          this.handlers.onDirection(this.directions.up);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          this.handlers.onDirection(this.directions.down);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          this.handlers.onDirection(this.directions.left);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          this.handlers.onDirection(this.directions.right);
          break;
        case ' ':
        case 'Escape':
          e.preventDefault();
          this.handlers.onTogglePause();
          break;
        case 'Shift':
        case 'e':
        case 'E':
        case 'b':
        case 'B':
          e.preventDefault();
          if (!this.isPaused) this.handlers.onSurge();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          if (!this.isPaused) this.handlers.onToggleFps();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          if (!this.isPaused) this.handlers.onToggleSound();
          break;
        default:
          break;
      }
    });

    const touchBtns = document.querySelectorAll<HTMLButtonElement>('.touch-btn');
    touchBtns.forEach(btn => {
      const activate = (): void => {
        if (!this.isEnabled || this.isPaused) return;
        const dir = btn.dataset.dir;
        if (dir === 'surge') {
          this.handlers.onSurge();
          return;
        }
        if (dir && this.directions[dir]) {
          this.handlers.onDirection(this.directions[dir]);
        }
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activate();
      });
      btn.addEventListener('click', (e) => {
        // Native keyboard activation has detail 0; pointer input was handled above.
        if (e.detail === 0) activate();
      });
    });

    this.canvas.addEventListener('touchstart', (e) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchHandled = false;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isEnabled || this.isPaused || this.touchHandled) return;
      const touchMoveX = e.touches[0].clientX;
      const touchMoveY = e.touches[0].clientY;
      const dx = touchMoveX - this.touchStartX;
      const dy = touchMoveY - this.touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < this.touchThreshold) return;
      if (absX > absY) {
        if (dx > 0) this.handlers.onDirection(this.directions.right);
        else this.handlers.onDirection(this.directions.left);
      } else {
        if (dy > 0) this.handlers.onDirection(this.directions.down);
        else this.handlers.onDirection(this.directions.up);
      }
      this.touchHandled = true;
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (!this.isEnabled || this.isPaused) return;
      if (this.touchHandled) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - this.touchStartX;
      const dy = touchEndY - this.touchStartY;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) this.handlers.onDirection(this.directions.right);
        else this.handlers.onDirection(this.directions.left);
      } else {
        if (dy > 0) this.handlers.onDirection(this.directions.down);
        else this.handlers.onDirection(this.directions.up);
      }
    }, { passive: false });
  }
}
