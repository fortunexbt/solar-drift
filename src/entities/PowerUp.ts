import { POWERUP_TYPES } from '../config';
import { Vector2D } from '../core';
import type { PowerUpType } from '../types';

export class PowerUp {
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
  maxX: number;
  maxY: number;
  pulsePhase: number;
  type: PowerUpType;
  position: Vector2D;

  constructor(canvasWidth: number, canvasHeight: number, gridSize: number) {
    this.gridSize = gridSize;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.maxX = Math.floor(canvasWidth / gridSize);
    this.maxY = Math.floor(canvasHeight / gridSize);
    this.pulsePhase = 0;
    this.type = this.selectType();
    this.position = this.getRandomPosition();
  }

  selectType(): PowerUpType {
    const types = Object.values(POWERUP_TYPES) as PowerUpType[];
    return types[Math.floor(Math.random() * types.length)];
  }

  getRandomPosition(): Vector2D {
    return new Vector2D(
      Math.floor(Math.random() * this.maxX),
      Math.floor(Math.random() * this.maxY)
    );
  }

  respawn(): void {
    this.position = this.getRandomPosition();
    this.pulsePhase = 0;
    this.type = this.selectType();
  }

  respawnAt(x: number, y: number): void {
    this.position = new Vector2D(x, y);
    this.pulsePhase = 0;
    this.type = this.selectType();
  }

  update(): void {
    this.pulsePhase += 0.03;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x * this.gridSize + this.gridSize / 2;
    const y = this.position.y * this.gridSize + this.gridSize / 2;
    const baseRadius = this.gridSize / 2 - 2;
    const pulseSize = Math.sin(this.pulsePhase) * 4;

    ctx.save();
    ctx.shadowBlur = 30 + pulseSize * 2;
    ctx.shadowColor = this.type.glow;

    ctx.fillStyle = this.type.color;
    ctx.beginPath();
    ctx.arc(x, y, baseRadius + pulseSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + Math.sin(this.pulsePhase * 2) * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, baseRadius + 6 + pulseSize * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff4e6';
    ctx.font = `${Math.floor(this.gridSize * 0.4)}px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(this.type.icon, x, y + 1);

    ctx.restore();
  }

  getPosition(): Vector2D {
    return this.position.copy();
  }

  getType(): PowerUpType {
    return this.type;
  }
}
