import type { LegacyNeonSnake } from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const randRange = (min: number, max: number): number => Math.random() * (max - min) + min;

export const randInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

export const choose = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const shuffle = <T>(arr: T[]): T[] => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const pad2 = (value: number): string => value.toString().padStart(2, '0');

export const getLocalDateKey = (date: Date = new Date()): string => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const value = parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

export const rgbToRgba = (rgb: { r: number; g: number; b: number }, alpha: number): string => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

export const encodeSharePayload = (payload: unknown): string => {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
};

export const decodeSharePayload = <T = unknown>(value: string): T => {
  const json = decodeURIComponent(escape(atob(value)));
  return JSON.parse(json) as T;
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const utils = {
  clamp,
  lerp,
  randRange,
  randInt,
  choose,
  shuffle,
  pad2,
  getLocalDateKey,
  hashString,
  hexToRgb,
  rgbToRgba,
  encodeSharePayload,
  decodeSharePayload,
  easeOutCubic,
  easeInOutQuad,
  formatTime
} as const;

if (typeof window !== 'undefined') {
  const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
  NS.utils = utils;
}
