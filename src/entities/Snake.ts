import { CONFIG } from '../config';
import { Vector2D } from '../core';
import type { PowerUpType, Skin } from '../types';

type ActivePowerUp = {
  type: string;
  name: string;
  icon: string;
  color: string;
  duration: number;
  multiplier: number;
  startTime: number;
};

type TrailSegment = {
  x: number;
  y: number;
  life: number;
};

type ExternalModifiers = {
  speed?: number;
  score?: number;
  ghost?: boolean;
  magnetBonus?: number;
};

export class Snake {
  gridSize: number;
  segments: Vector2D[];
  direction: Vector2D;
  nextDirection: Vector2D;
  directionQueue: Vector2D[];
  growing: boolean;
  trail: TrailSegment[];
  trailPool: TrailSegment[];
  maxTrailLength: number;
  moveTimer: number;
  moveInterval: number;
  baseSpeed: number;
  skinColors: Skin;
  trailTimer: number;
  activePowerUps: ActivePowerUp[];
  isGhostMode: boolean;
  scoreMultiplier: number;
  speedMultiplier: number;
  hasMagnet: boolean;
  baseMagnetRange: number;
  magnetRange: number;
  externalSpeedMultiplier: number;
  externalScoreMultiplier: number;
  externalGhost: boolean;
  externalMagnetBonus: number;
  pendingPrecision: boolean;
  lastTurnRatio: number;

  constructor(startX: number, startY: number, gridSize: number, skinColors: Skin, initialLength = 1) {
    this.gridSize = gridSize;
    this.segments = [];
    for (let i = 0; i < initialLength; i += 1) {
      this.segments.push(new Vector2D(startX - i, startY));
    }
    this.direction = new Vector2D(1, 0);
    this.nextDirection = new Vector2D(1, 0);
    this.directionQueue = [];
    this.growing = false;
    this.trail = [];
    this.trailPool = [];
    this.maxTrailLength = 10;
    this.moveTimer = 0;
    this.moveInterval = CONFIG.INITIAL_SPEED;
    this.baseSpeed = CONFIG.INITIAL_SPEED;
    this.skinColors = skinColors;
    this.trailTimer = 0;

    this.activePowerUps = [];
    this.isGhostMode = false;
    this.scoreMultiplier = 1;
    this.speedMultiplier = 1;
    this.hasMagnet = false;
    this.baseMagnetRange = CONFIG.MAGNET_RANGE * gridSize;
    this.magnetRange = this.baseMagnetRange;

    this.externalSpeedMultiplier = 1;
    this.externalScoreMultiplier = 1;
    this.externalGhost = false;
    this.externalMagnetBonus = 0;

    this.pendingPrecision = false;
    this.lastTurnRatio = 0;
  }

  setExternalModifiers({ speed, score, ghost, magnetBonus }: ExternalModifiers): void {
    if (typeof speed === 'number') this.externalSpeedMultiplier = speed;
    if (typeof score === 'number') this.externalScoreMultiplier = score;
    if (typeof ghost === 'boolean') this.externalGhost = ghost;
    if (typeof magnetBonus === 'number') this.externalMagnetBonus = magnetBonus;
    this.updatePowerUpProperties();
  }

  updatePowerUps(nowMs?: number): void {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    for (let i = this.activePowerUps.length - 1; i >= 0; i -= 1) {
      const powerUp = this.activePowerUps[i];
      const elapsed = now - powerUp.startTime;
      if (elapsed >= powerUp.duration) {
        this.activePowerUps.splice(i, 1);
      }
    }
    this.updatePowerUpProperties();
  }

  updatePowerUpProperties(): void {
    let ghost = this.externalGhost;
    let scoreMult = this.externalScoreMultiplier;
    let speedMult = this.externalSpeedMultiplier;
    let hasMagnet = false;

    for (const powerUp of this.activePowerUps) {
      switch (powerUp.type) {
        case 'SPEED':
          speedMult *= powerUp.multiplier || 0.7;
          break;
        case 'GHOST':
          ghost = true;
          break;
        case '2X':
          scoreMult *= powerUp.multiplier || 2;
          break;
        case 'MAG':
          hasMagnet = true;
          break;
      }
    }

    this.isGhostMode = ghost;
    this.scoreMultiplier = scoreMult;
    this.speedMultiplier = speedMult;
    this.hasMagnet = hasMagnet;
    this.magnetRange = this.baseMagnetRange + this.externalMagnetBonus * this.gridSize;
    this.moveInterval = this.baseSpeed * this.speedMultiplier;
  }

  addPowerUp(powerUpType: PowerUpType, nowMs?: number): void {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    const existingIndex = this.activePowerUps.findIndex(p => p.type === powerUpType.name);
    if (existingIndex !== -1) {
      this.activePowerUps[existingIndex].startTime = now;
    } else {
      this.activePowerUps.push({
        type: powerUpType.name,
        name: powerUpType.name,
        icon: powerUpType.icon,
        color: powerUpType.color,
        duration: powerUpType.duration,
        multiplier: powerUpType.multiplier,
        startTime: now
      });
    }
    this.updatePowerUpProperties();
  }

  getActivePowerUps(nowMs?: number): Array<ActivePowerUp & { remaining: number; progress: number }> {
    const now = typeof nowMs === 'number' ? nowMs : Date.now();
    return this.activePowerUps.map(p => ({
      ...p,
      remaining: Math.max(0, p.duration - (now - p.startTime)),
      progress: Math.max(0, (p.duration - (now - p.startTime)) / p.duration)
    }));
  }

  setDirection(direction: Vector2D): void {
    const lastIntent = this.directionQueue.length
      ? this.directionQueue[this.directionQueue.length - 1]
      : this.nextDirection;

    const hasPendingTurn = this.nextDirection.x !== this.direction.x || this.nextDirection.y !== this.direction.y;

    if (lastIntent.x === -direction.x && lastIntent.y === -direction.y) return;
    if (lastIntent.x === direction.x && lastIntent.y === direction.y) return;

    if (hasPendingTurn && this.directionQueue.length === 0) {
      if (this.directionQueue.length < 2) {
        this.directionQueue.push(direction);
      }
      return;
    }

    if (this.directionQueue.length === 0 && (this.nextDirection.x !== direction.x || this.nextDirection.y !== direction.y)) {
      if (this.direction.x !== direction.x || this.direction.y !== direction.y) {
        this.pendingPrecision = true;
        this.lastTurnRatio = this.moveInterval > 0 ? this.moveTimer / this.moveInterval : 0;
      }
      this.nextDirection = direction;
      return;
    }

    if (this.directionQueue.length < 2) {
      this.directionQueue.push(direction);
    }
  }

  consumePrecision(): number {
    if (!this.pendingPrecision) return 0;
    this.pendingPrecision = false;
    return this.lastTurnRatio;
  }

  update(deltaTime: number): boolean {
    this.updateTrail();
    this.moveTimer += deltaTime;
    let steps = 0;
    const maxSteps = 4;
    while (this.moveTimer >= this.moveInterval && steps < maxSteps) {
      this.moveTimer -= this.moveInterval;
      this.move();
      steps += 1;
    }
    if (steps === maxSteps) {
      this.moveTimer = 0;
    }

    this.trailTimer += deltaTime;
    if (this.trailTimer > 50) {
      this.trailTimer = 0;
      return true;
    }
    return false;
  }

  updateTrail(): void {
    const head = this.segments[0];
    let segment = this.trailPool.pop();
    if (!segment) segment = { x: 0, y: 0, life: 1 };
    segment.x = head.x * this.gridSize + this.gridSize / 2;
    segment.y = head.y * this.gridSize + this.gridSize / 2;
    segment.life = 1;
    this.trail.push(segment);

    for (let i = this.trail.length - 1; i >= 0; i -= 1) {
      const t = this.trail[i];
      t.life -= 0.1;
      if (t.life <= 0) {
        this.trailPool.push(t);
        this.trail.splice(i, 1);
      }
    }

    if (this.trail.length > this.maxTrailLength) {
      const removed = this.trail.shift();
      if (removed) this.trailPool.push(removed);
    }
  }

  getTrailEmitPosition(): { x: number; y: number } {
    const head = this.segments[0];
    return {
      x: head.x * this.gridSize + this.gridSize / 2,
      y: head.y * this.gridSize + this.gridSize / 2
    };
  }

  move(): void {
    this.direction = this.nextDirection;
    if (this.directionQueue.length > 0) {
      this.nextDirection = this.directionQueue.shift() as Vector2D;
    }
    const head = this.segments[0].copy();
    head.x += this.direction.x;
    head.y += this.direction.y;
    this.segments.unshift(head);
    if (!this.growing) {
      this.segments.pop();
    } else {
      this.growing = false;
    }
  }

  grow(): void {
    this.growing = true;
  }

  checkSelfCollision(): boolean {
    if (this.isGhostMode) return false;
    const head = this.segments[0];
    for (let i = 1; i < this.segments.length; i += 1) {
      if (head.equals(this.segments[i])) return true;
    }
    return false;
  }

  checkWallCollision(canvasWidth: number, canvasHeight: number): boolean {
    const head = this.segments[0];
    const maxX = Math.floor(canvasWidth / this.gridSize);
    const maxY = Math.floor(canvasHeight / this.gridSize);
    return head.x < 0 || head.x >= maxX || head.y < 0 || head.y >= maxY;
  }

  wrapAround(canvasWidth: number, canvasHeight: number): void {
    const head = this.segments[0];
    const maxX = Math.floor(canvasWidth / this.gridSize);
    const maxY = Math.floor(canvasHeight / this.gridSize);
    if (head.x < 0) head.x = maxX - 1;
    else if (head.x >= maxX) head.x = 0;
    else if (head.y < 0) head.y = maxY - 1;
    else if (head.y >= maxY) head.y = 0;
  }

  getHead(): Vector2D {
    return this.segments[0].copy();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.drawTrail(ctx);
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      const x = segment.x * this.gridSize;
      const y = segment.y * this.gridSize;
      const isHead = i === 0;

      ctx.save();
      if (isHead) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.skinColors.glow;
        ctx.fillStyle = this.skinColors.head;
      } else {
        const fadeFactor = 1 - (i / this.segments.length) * 0.5;
        ctx.shadowBlur = 18 * fadeFactor;
        ctx.shadowColor = this.skinColors.glow;
        ctx.fillStyle = this.skinColors.body;
      }
      this.drawRoundedRect(ctx, x + 1, y + 1, this.gridSize - 2, this.gridSize - 2, 4);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(x + 4, y + this.gridSize / 2 - 1, this.gridSize - 8, 2);

      if (isHead) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(x + this.gridSize / 2, y + this.gridSize / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawTrail(ctx: CanvasRenderingContext2D): void {
    if (this.trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = this.trail.length - 1; i > 0; i -= 1) {
      const current = this.trail[i];
      const next = this.trail[i - 1];
      const alpha = current.life * 0.5;
      const lineWidth = 2 + current.life * 5;
      ctx.strokeStyle = this.hexToRgba(this.skinColors.trail, alpha);
      ctx.shadowBlur = 14 * current.life;
      ctx.shadowColor = this.skinColors.glow;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(current.x, current.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  getLength(): number {
    return this.segments.length;
  }

  getSegments(): Vector2D[] {
    return this.segments.map(s => s.copy());
  }
}
