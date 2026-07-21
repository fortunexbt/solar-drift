import { clamp, hexToRgb, randRange, rgbToRgba } from './utils';
import type { LegacyNeonSnake } from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

type Rgb = { r: number; g: number; b: number };

export class GlowRenderer {
  width: number;
  height: number;
  mainCanvas: HTMLCanvasElement;
  mainCtx: CanvasRenderingContext2D;
  downCanvas: HTMLCanvasElement;
  downCtx: CanvasRenderingContext2D;
  enabled: boolean;
  blurAmount: number;
  intensity: number;
  downsampleScale: number;
  blurPasses: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.mainCanvas = document.createElement('canvas');
    this.mainCanvas.width = width;
    this.mainCanvas.height = height;
    this.mainCtx = this.mainCanvas.getContext('2d')!;

    this.downCanvas = document.createElement('canvas');
    this.downCtx = this.downCanvas.getContext('2d')!;

    this.enabled = true;
    this.blurAmount = 8;
    this.intensity = 0.55;
    this.downsampleScale = 0.5;
    this.blurPasses = 2;
  }

  setQuality(quality: { bloom: boolean; blur: number; intensity: number; downsample: number }): void {
    this.enabled = quality.bloom;
    this.blurAmount = quality.blur;
    this.intensity = quality.intensity;
    this.downsampleScale = quality.downsample;
  }

  getContext(): CanvasRenderingContext2D {
    return this.mainCtx;
  }

  clear(background?: string): void {
    this.mainCtx.fillStyle = background || '#0b0d0f';
    this.mainCtx.fillRect(0, 0, this.width, this.height);
  }

  render(targetCtx: CanvasRenderingContext2D): void {
    if (!this.enabled) {
      targetCtx.drawImage(this.mainCanvas, 0, 0);
      return;
    }

    const downWidth = Math.max(1, Math.floor(this.width * this.downsampleScale));
    const downHeight = Math.max(1, Math.floor(this.height * this.downsampleScale));
    if (this.downCanvas.width !== downWidth || this.downCanvas.height !== downHeight) {
      this.downCanvas.width = downWidth;
      this.downCanvas.height = downHeight;
    }

    this.downCtx.clearRect(0, 0, downWidth, downHeight);
    this.downCtx.drawImage(this.mainCanvas, 0, 0, downWidth, downHeight);
    this.applyBlur(this.downCtx, Math.max(1, Math.floor(this.blurAmount * this.downsampleScale)));

    targetCtx.save();
    targetCtx.drawImage(this.mainCanvas, 0, 0);
    targetCtx.globalCompositeOperation = 'screen';
    targetCtx.globalAlpha = this.intensity;
    targetCtx.drawImage(this.downCanvas, 0, 0, this.width, this.height);
    targetCtx.restore();
  }

  applyBlur(ctx: CanvasRenderingContext2D, radius: number): void {
    const source = ctx.canvas;
    ctx.save();
    for (let i = 0; i < this.blurPasses; i += 1) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(source, -radius, 0);
      ctx.drawImage(source, radius, 0);
      ctx.drawImage(source, 0, -radius);
      ctx.drawImage(source, 0, radius);
    }
    ctx.restore();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.mainCanvas.width = width;
    this.mainCanvas.height = height;
    this.downCanvas.width = Math.max(1, Math.floor(width * this.downsampleScale));
    this.downCanvas.height = Math.max(1, Math.floor(height * this.downsampleScale));
  }
}

export class PostFxRenderer {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  noiseCanvas: HTMLCanvasElement;
  noiseCtx: CanvasRenderingContext2D;
  noiseStrength: number;
  aberration: number;
  lastNoiseBuild: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;

    this.noiseCanvas = document.createElement('canvas');
    this.noiseCanvas.width = 128;
    this.noiseCanvas.height = 128;
    this.noiseCtx = this.noiseCanvas.getContext('2d')!;
    this.noiseStrength = 0.08;
    this.aberration = 0;
    this.lastNoiseBuild = 0;
    this.buildNoise();
  }

  setQuality(quality: { noiseStrength: number }): void {
    this.noiseStrength = quality.noiseStrength;
  }

  setAberration(amount: number): void {
    this.aberration = amount;
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  buildNoise(): void {
    const imageData = this.noiseCtx.createImageData(128, 128);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 255;
    }
    this.noiseCtx.putImageData(imageData, 0, 0);
  }

  renderTo(targetCtx: CanvasRenderingContext2D, timeMs?: number, lowQuality?: boolean): void {
    targetCtx.drawImage(this.canvas, 0, 0);

    targetCtx.save();
    const vignette = targetCtx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.58,
      this.width * 0.18,
      this.width * 0.5,
      this.height * 0.58,
      this.width * 0.7
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    targetCtx.fillStyle = vignette;
    targetCtx.fillRect(0, 0, this.width, this.height);
    targetCtx.restore();

    const now = timeMs ?? performance.now();
    const noiseInterval = lowQuality ? 140 : 90;
    if (now - this.lastNoiseBuild > noiseInterval) {
      this.buildNoise();
      this.lastNoiseBuild = now;
    }

    targetCtx.save();
    targetCtx.globalAlpha = lowQuality ? this.noiseStrength * 0.6 : this.noiseStrength;
    targetCtx.globalCompositeOperation = 'screen';
    targetCtx.drawImage(this.noiseCanvas, 0, 0, this.width, this.height);
    targetCtx.restore();

    if (this.aberration > 0) {
      targetCtx.save();
      targetCtx.globalCompositeOperation = 'screen';
      targetCtx.globalAlpha = 0.16;
      targetCtx.drawImage(this.canvas, -this.aberration, 0);
      targetCtx.globalAlpha = 0.12;
      targetCtx.drawImage(this.canvas, this.aberration, 0);
      targetCtx.restore();
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }
}

export class Grid {
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  offset: number;
  scanlineOffset: number;
  pulse: number;

  constructor(canvasWidth: number, canvasHeight: number, gridSize: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.gridSize = gridSize;
    this.offset = 0;
    this.scanlineOffset = 0;
    this.pulse = 0;
  }

  update(): void {
    this.offset = (this.offset + 0.4) % this.gridSize;
    this.scanlineOffset = (this.scanlineOffset + 0.35) % 4;
    this.pulse = (this.pulse + 0.02) % (Math.PI * 2);
  }

  draw(ctx: CanvasRenderingContext2D, colors: { grid: string; gridGlow: string }, scanlines: boolean): void {
    ctx.save();
    const intensity = 0.5 + Math.sin(this.pulse) * 0.18;
    ctx.globalAlpha = intensity;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.shadowBlur = 6;
    ctx.shadowColor = colors.gridGlow;

    const horizonY = this.canvasHeight * 0.2;
    const rows = Math.floor(this.canvasHeight / this.gridSize);
    for (let i = 0; i <= rows; i += 1) {
      const t = i / rows;
      const y = horizonY + (this.canvasHeight - horizonY) * (t * t);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvasWidth, y);
      ctx.stroke();
    }

    const cols = Math.floor(this.canvasWidth / this.gridSize);
    for (let i = 0; i <= cols; i += 1) {
      const t = i / cols;
      const bottomX = t * this.canvasWidth;
      const topX = this.canvasWidth * 0.5 + (bottomX - this.canvasWidth * 0.5) * 0.2;
      ctx.beginPath();
      ctx.moveTo(bottomX, this.canvasHeight);
      ctx.lineTo(topX, horizonY);
      ctx.stroke();
    }

    ctx.restore();

    if (scanlines) {
      ctx.save();
      ctx.fillStyle = 'rgba(43, 179, 177, 0.05)';
      for (let y = this.scanlineOffset; y < this.canvasHeight; y += 4) {
        ctx.fillRect(0, y, this.canvasWidth, 1);
      }
      ctx.restore();
    }
  }
}

interface BackdropOrb {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
  rgb: Rgb;
  pulse: number;
  pulseSpeed: number;
}

export class NeonBackdrop {
  width: number;
  height: number;
  orbs: BackdropOrb[];
  sweep: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.orbs = [];
    this.sweep = 0;
    this.createOrbs();
  }

  createOrbs(count = 10): void {
    const colors = ['#2bb3b1', '#d45f5d', '#6bbf6a', '#f08a4b'];
    this.orbs = [];
    for (let i = 0; i < count; i += 1) {
      const color = colors[i % colors.length];
      this.orbs.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: 140 + Math.random() * 240,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        alpha: 0.08 + Math.random() * 0.1,
        rgb: hexToRgb(color),
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.001 + Math.random() * 0.002
      });
    }
  }

  resize(width: number, height: number, orbCount?: number): void {
    this.width = width;
    this.height = height;
    this.createOrbs(orbCount || this.orbs.length || 6);
  }

  update(deltaTime: number): void {
    this.sweep += deltaTime * 0.00018;
    for (const orb of this.orbs) {
      orb.x += orb.vx * deltaTime;
      orb.y += orb.vy * deltaTime;
      orb.pulse += deltaTime * orb.pulseSpeed;

      const buffer = orb.radius * 0.6;
      if (orb.x < -buffer) orb.x = this.width + buffer;
      if (orb.x > this.width + buffer) orb.x = -buffer;
      if (orb.y < -buffer) orb.y = this.height + buffer;
      if (orb.y > this.height + buffer) orb.y = -buffer;
    }
  }

  draw(ctx: CanvasRenderingContext2D, lowQuality: boolean, orbLimit?: number): void {
    const base = ctx.createLinearGradient(0, 0, 0, this.height);
    base.addColorStop(0, '#0b0e10');
    base.addColorStop(0.55, '#121a1c');
    base.addColorStop(1, '#070809');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, this.width, this.height);

    const horizon = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.75,
      80,
      this.width * 0.5,
      this.height * 0.78,
      this.width * 0.85
    );
    horizon.addColorStop(0, 'rgba(43, 179, 177, 0.16)');
    horizon.addColorStop(1, 'transparent');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, this.width, this.height);

    const bandCount = lowQuality ? 2 : 3;
    for (let i = 0; i < bandCount; i += 1) {
      const t = (this.sweep + i * 0.3) % 1;
      const y = this.height * (0.2 + t * 0.7);
      const band = ctx.createLinearGradient(0, y - 30, 0, y + 30);
      band.addColorStop(0, 'transparent');
      band.addColorStop(0.5, 'rgba(43, 179, 177, 0.05)');
      band.addColorStop(1, 'transparent');
      ctx.fillStyle = band;
      ctx.fillRect(0, y - 30, this.width, 60);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const limit = orbLimit || this.orbs.length;
    for (let i = 0; i < limit; i += 1) {
      const orb = this.orbs[i];
      const pulse = 1 + Math.sin(orb.pulse) * 0.08;
      const radius = orb.radius * pulse;
      const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, radius);
      gradient.addColorStop(0, rgbToRgba(orb.rgb, orb.alpha));
      gradient.addColorStop(0.6, rgbToRgba(orb.rgb, orb.alpha * 0.4));
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(orb.x - radius, orb.y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
  }
}

export class SkylineLayer {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  offset: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.offset = 0;
    this.build(false);
  }

  build(lowQuality: boolean): void {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const baseY = Math.floor(this.height * 0.62);
    const buildingCount = lowQuality ? 16 : 26;
    const buildingWidth = this.width / buildingCount;

    for (let i = 0; i < buildingCount; i += 1) {
      const x = i * buildingWidth;
      const h = baseY - (100 + Math.random() * 190);
      ctx.fillStyle = 'rgba(11, 14, 18, 0.88)';
      ctx.fillRect(x, h, buildingWidth + 2, baseY - h);

      const windowRows = lowQuality ? 3 : 6;
      const windowCols = 3;
      for (let r = 0; r < windowRows; r += 1) {
        for (let c = 0; c < windowCols; c += 1) {
          if (Math.random() < 0.3) {
            ctx.fillStyle = 'rgba(43, 179, 177, 0.2)';
            ctx.fillRect(x + 8 + c * 10, h + 12 + r * 14, 5, 7);
          }
        }
      }
    }

    const glow = ctx.createLinearGradient(0, baseY - 40, 0, baseY + 80);
    glow.addColorStop(0, 'rgba(43, 179, 177, 0.12)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, baseY - 40, this.width, 120);
  }

  update(deltaTime: number): void {
    this.offset = (this.offset + deltaTime * 0.004) % this.width;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.drawImage(this.canvas, -this.offset, 0);
    ctx.drawImage(this.canvas, this.width - this.offset, 0);
    ctx.restore();
  }

  resize(width: number, height: number, lowQuality: boolean): void {
    this.width = width;
    this.height = height;
    this.build(lowQuality);
  }
}

export class ScreenShake {
  intensity: number;
  decay: number;
  offsetX: number;
  offsetY: number;
  active: boolean;

  constructor() {
    this.intensity = 0;
    this.decay = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.active = false;
  }

  shake(intensity: number, duration: number): void {
    this.intensity = intensity;
    this.decay = intensity / (duration * 60);
    this.active = true;
  }

  update(): void {
    if (!this.active || this.intensity <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      this.active = false;
      return;
    }
    this.offsetX = (Math.random() - 0.5) * this.intensity;
    this.offsetY = (Math.random() - 0.5) * this.intensity;
    this.intensity -= this.decay;
    if (this.intensity < 0) this.intensity = 0;
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  small(): void { this.shake(5, 0.2); }
  medium(): void { this.shake(10, 0.3); }
  big(): void { this.shake(18, 0.5); }
}

class PulseRing {
  x: number;
  y: number;
  maxRadius: number;
  duration: number;
  thickness: number;
  age: number;
  rgb: Rgb;

  constructor(x: number, y: number, color: string, maxRadius: number, duration: number, thickness = 3) {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.thickness = thickness;
    this.age = 0;
    this.rgb = hexToRgb(color);
  }

  update(deltaTime: number): void {
    this.age += deltaTime;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const progress = clamp(this.age / this.duration, 0, 1);
    const radius = this.maxRadius * (0.25 + progress * 0.75);
    const alpha = (1 - progress) * 0.75;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = rgbToRgba(this.rgb, alpha);
    ctx.lineWidth = this.thickness;
    ctx.shadowBlur = 20 * (1 - progress);
    ctx.shadowColor = rgbToRgba(this.rgb, 0.8);
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  isDead(): boolean {
    return this.age >= this.duration;
  }
}

export class PulseSystem {
  pulses: PulseRing[];

  constructor() {
    this.pulses = [];
  }

  emit(x: number, y: number, color: string, maxRadius: number, duration: number, thickness?: number): void {
    this.pulses.push(new PulseRing(x, y, color, maxRadius, duration, thickness));
  }

  update(deltaTime: number): void {
    this.pulses = this.pulses.filter(pulse => {
      pulse.update(deltaTime);
      return !pulse.isDead();
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.pulses.forEach(pulse => pulse.draw(ctx));
  }
}

const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
NS.GlowRenderer = GlowRenderer;
NS.PostFxRenderer = PostFxRenderer;
NS.Grid = Grid;
NS.NeonBackdrop = NeonBackdrop;
NS.SkylineLayer = SkylineLayer;
NS.ScreenShake = ScreenShake;
NS.PulseSystem = PulseSystem;
