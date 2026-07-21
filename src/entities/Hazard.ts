import { Vector2D } from '../core';

export type HazardState = 'warning' | 'active';

export class Hazard {
  position: Vector2D;
  warningDuration: number;
  activeDuration: number;
  timer: number;
  state: HazardState;
  pulse: number;

  constructor(position: Vector2D, warningDuration: number, activeDuration: number) {
    this.position = position;
    this.warningDuration = warningDuration;
    this.activeDuration = activeDuration;
    this.timer = 0;
    this.state = 'warning';
    this.pulse = 0;
  }

  update(deltaTime: number): void {
    this.timer += deltaTime;
    this.pulse += 0.08;

    if (this.state === 'warning' && this.timer >= this.warningDuration) {
      this.state = 'active';
      this.timer = 0;
    } else if (this.state === 'active' && this.timer >= this.activeDuration) {
      this.state = 'warning';
      this.timer = 0;
    }
  }

  isActive(): boolean {
    return this.state === 'active';
  }

  draw(ctx: CanvasRenderingContext2D, gridSize: number): void {
    const x = this.position.x * gridSize;
    const y = this.position.y * gridSize;
    const inset = 2;
    const pulseSize = Math.sin(this.pulse) * 2;

    ctx.save();

    if (this.state === 'warning') {
      const alpha = 0.35 + Math.sin(this.pulse * 2) * 0.3;
      ctx.fillStyle = `rgba(199, 58, 47, ${alpha})`;
      ctx.strokeStyle = 'rgba(199, 58, 47, 0.9)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#c73a2f';
      ctx.fillRect(x + inset, y + inset, gridSize - inset * 2, gridSize - inset * 2);
      ctx.strokeRect(x + inset, y + inset, gridSize - inset * 2, gridSize - inset * 2);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + inset + 2, y + inset + 2);
      ctx.lineTo(x + gridSize - inset - 2, y + gridSize - inset - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + gridSize - inset - 2, y + inset + 2);
      ctx.lineTo(x + inset + 2, y + gridSize - inset - 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#c73a2f';
      ctx.shadowBlur = 18 + pulseSize;
      ctx.shadowColor = '#c73a2f';
      ctx.fillRect(x + inset, y + inset, gridSize - inset * 2, gridSize - inset * 2);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + inset + 1, y + inset + 1, gridSize - inset * 2 - 2, gridSize - inset * 2 - 2);
    }

    ctx.restore();
  }
}
