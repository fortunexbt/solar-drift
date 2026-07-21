import { CONFIG, FOOD_TYPES } from '../config';
import { Vector2D } from '../core';
import type { FoodType } from '../types';

export class Food {
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
  maxX: number;
  maxY: number;
  pulsePhase: number;
  type: FoodType;
  weights: Record<string, number> | null;
  volatileTtlMs: number;
  expiresAt: number;
  position!: Vector2D;

  constructor(canvasWidth: number, canvasHeight: number, gridSize: number) {
    this.gridSize = gridSize;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.maxX = Math.floor(canvasWidth / gridSize);
    this.maxY = Math.floor(canvasHeight / gridSize);
    this.pulsePhase = 0;
    this.type = FOOD_TYPES.BASIC;
    this.weights = null;
    this.volatileTtlMs = 0;
    this.expiresAt = 0;
    this.respawn();
  }

  setWeights(weights: Record<string, number>): void {
    this.weights = weights;
  }

  setVolatileTtl(ttlMs: number): void {
    this.volatileTtlMs = ttlMs;
  }

  selectType(): FoodType {
    const weights = this.weights;
    let total = 0;

    for (const key in FOOD_TYPES) {
      const weight = weights && typeof weights[key] === 'number'
        ? weights[key]
        : FOOD_TYPES[key as keyof typeof FOOD_TYPES].spawnChance;
      total += weight;
    }

    const rand = Math.random() * (total || 1);
    let cumulative = 0;

    for (const key in FOOD_TYPES) {
      const weight = weights && typeof weights[key] === 'number'
        ? weights[key]
        : FOOD_TYPES[key as keyof typeof FOOD_TYPES].spawnChance;
      cumulative += weight;
      if (rand <= cumulative) {
        return FOOD_TYPES[key as keyof typeof FOOD_TYPES];
      }
    }
    return FOOD_TYPES.BASIC;
  }

  respawn(nowMs?: number): void {
    this.position = new Vector2D(
      Math.floor(Math.random() * this.maxX),
      Math.floor(Math.random() * this.maxY)
    );
    this.pulsePhase = 0;
    this.type = this.selectType();
    if (this.type.name === 'volatile' && this.volatileTtlMs > 0 && typeof nowMs === 'number') {
      this.expiresAt = nowMs + this.volatileTtlMs;
    } else {
      this.expiresAt = 0;
    }
  }

  update(nowMs?: number): 'detonate' | null {
    this.pulsePhase += this.type.pulseSpeed;
    if (this.type.name === 'volatile' && this.expiresAt && typeof nowMs === 'number' && nowMs >= this.expiresAt) {
      return 'detonate';
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.position.x * this.gridSize + this.gridSize / 2;
    const y = this.position.y * this.gridSize + this.gridSize / 2;
    const baseRadius = this.gridSize / 2 - 2;
    const pulseSize = Math.sin(this.pulsePhase) * 3;

    ctx.save();
    ctx.shadowBlur = 24 + pulseSize * 2;
    ctx.shadowColor = this.type.glowColor;

    ctx.fillStyle = this.type.color;
    ctx.beginPath();
    ctx.arc(x, y, baseRadius + pulseSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff4e6';
    ctx.beginPath();
    ctx.arc(x, y, baseRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    if (this.type.name !== 'basic') {
      ctx.strokeStyle = this.type.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(this.pulsePhase * 2) * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.type.name === 'volatile') {
      ctx.strokeStyle = '#fff4e6';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4 + Math.sin(this.pulsePhase * 4) * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  getPosition(): Vector2D {
    return this.position.copy();
  }

  getPoints(): number {
    return this.type.points;
  }

  getParticleColor(): string {
    return this.type.particleColor;
  }
}
