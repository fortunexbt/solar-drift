import type { LegacyNeonSnake } from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

type ParticleKind = 'spark' | 'explosion' | 'trail' | 'default';

class Particle {
  alive: boolean;
  type: ParticleKind;
  color: string;
  life: number;
  decay: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;

  constructor() {
    this.alive = false;
    this.type = 'spark';
    this.color = '#fff4e6';
    this.life = 0;
    this.decay = 0.02;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 2;
  }

  reset(x: number, y: number, color: string, type: ParticleKind = 'spark'): void {
    this.x = x;
    this.y = y;
    this.type = type;
    this.color = color;
    this.life = 1.0;
    this.alive = true;

    switch (type) {
      case 'spark':
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.size = 2 + Math.random() * 3;
        this.decay = 0.03 + Math.random() * 0.02;
        break;
      case 'explosion':
        this.vx = (Math.random() - 0.5) * 16;
        this.vy = (Math.random() - 0.5) * 16;
        this.size = 4 + Math.random() * 5;
        this.decay = 0.015 + Math.random() * 0.01;
        break;
      case 'trail':
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.size = 2 + Math.random() * 2.5;
        this.decay = 0.05 + Math.random() * 0.02;
        break;
      default:
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.size = 3 + Math.random() * 4;
        this.decay = 0.025 + Math.random() * 0.02;
    }
  }

  update(): void {
    if (!this.alive) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life -= this.decay;
    this.size *= 0.98;
    if (this.life <= 0.01) {
      this.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;

    switch (this.type) {
      case 'spark':
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'explosion':
        ctx.shadowBlur = 16;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const angle = (i / 4) * Math.PI * 2;
          const r = this.size;
          const px = this.x + Math.cos(angle) * r;
          const py = this.y + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);

          const innerAngle = ((i + 0.5) / 4) * Math.PI * 2;
          const innerR = this.size * 0.35;
          const ix = this.x + Math.cos(innerAngle) * innerR;
          const iy = this.y + Math.sin(innerAngle) * innerR;
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'trail':
        ctx.shadowBlur = 6;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
  }
}

export class ParticleSystem {
  particles: Particle[];
  pool: Particle[];
  maxParticles: number;

  constructor() {
    this.particles = [];
    this.pool = [];
    this.maxParticles = 700;
  }

  setLimit(limit: number): void {
    this.maxParticles = limit;
  }

  emit(x: number, y: number, count: number, color: string, type: ParticleKind = 'spark'): void {
    const available = this.maxParticles - this.particles.length;
    const actual = Math.max(0, Math.min(count, available));
    for (let i = 0; i < actual; i += 1) {
      const particle = this.pool.pop() || new Particle();
      particle.reset(x, y, color, type);
      this.particles.push(particle);
    }
  }

  emitTrail(x: number, y: number, color: string): void {
    const particle = this.pool.pop() || new Particle();
    particle.reset(x, y, color, 'trail');
    this.particles.push(particle);
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.update();
      if (!p.alive) {
        this.pool.push(p);
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.particles.length; i += 1) {
      this.particles[i].draw(ctx);
    }
  }
}

const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
NS.ParticleSystem = ParticleSystem;
