import { describe, expect, it } from 'vitest';
import {
  clamp,
  decodeSharePayload,
  easeInOutQuad,
  easeOutCubic,
  encodeSharePayload,
  formatTime,
  getLocalDateKey,
  hashString,
  hexToRgb,
  lerp,
  rgbToRgba
} from './utils';

describe('numeric helpers', () => {
  it('clamps and interpolates values', () => {
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('keeps easing endpoints exact', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeInOutQuad(0)).toBe(0);
    expect(easeInOutQuad(0.5)).toBe(0.5);
    expect(easeInOutQuad(1)).toBe(1);
  });
});

describe('serialization and formatting helpers', () => {
  it('round-trips a Unicode share payload', () => {
    const payload = { score: 420, pilot: 'SOL ☀', modules: ['ion_prism'] };
    expect(decodeSharePayload(encodeSharePayload(payload))).toEqual(payload);
  });

  it('creates stable hashes and local date keys', () => {
    expect(hashString('2026-07-21')).toBe(hashString('2026-07-21'));
    expect(hashString('2026-07-21')).not.toBe(hashString('2026-07-22'));
    expect(getLocalDateKey(new Date(2026, 6, 21, 23, 30))).toBe('2026-07-21');
  });

  it('converts colors and time labels', () => {
    expect(hexToRgb('#1f7f7a')).toEqual({ r: 31, g: 127, b: 122 });
    expect(rgbToRgba({ r: 31, g: 127, b: 122 }, 0.5)).toBe('rgba(31, 127, 122, 0.5)');
    expect(formatTime(125_999)).toBe('02:05');
  });
});
