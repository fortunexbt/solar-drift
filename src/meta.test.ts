import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from './config';
import { MetaStore } from './meta';
import type { LeaderboardEntry } from './types';
import { decodeSharePayload, getLocalDateKey, hashString } from './utils';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

const localStore = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStore
});

const entry = (id: string, score: number, timeMs: number): LeaderboardEntry => ({
  id,
  tag: id,
  score,
  timeMs,
  time: '00:42',
  date: '2026-07-21',
  mode: 'standard'
});

beforeEach(() => {
  localStore.clear();
  vi.useRealTimers();
});

describe('MetaStore persistence', () => {
  it('starts with conservative local-only defaults', () => {
    const store = new MetaStore();

    expect(store.data.version).toBe(CONFIG.META_VERSION);
    expect(store.data.level).toBe(1);
    expect(store.data.unlockedSkins).toEqual(['CLASSIC']);
    expect(store.data.leaderboard.allTime).toEqual([]);
  });

  it('falls back safely when stored data is corrupt', () => {
    localStorage.setItem(CONFIG.META_STORAGE_KEY, '{not-json');
    expect(new MetaStore().data).toMatchObject({ level: 1, shards: 0, highScore: 0 });
  });

  it('prices and purchases permanent upgrades deterministically', () => {
    const store = new MetaStore();
    store.data.shards = 200;

    expect(store.getUpgradeCost('startLength')).toBe(80);
    expect(store.purchaseUpgrade('startLength')).toEqual({ success: true });
    expect(store.data.shards).toBe(120);
    expect(store.getUpgradeLevel('startLength')).toBe(1);
    expect(store.getUpgradeCost('startLength')).toBe(132);
    expect(store.purchaseUpgrade('missing-upgrade')).toEqual({ success: false, reason: 'missing' });
  });
});

describe('MetaStore run utilities', () => {
  it('sorts leaderboard scores, breaks ties by time, and respects the limit', () => {
    const store = new MetaStore();
    const ranked = store.addLeaderboardEntry(
      [entry('slow', 300, 80_000), entry('lower', 200, 20_000)],
      entry('fast', 300, 40_000),
      2
    );

    expect(ranked.map(item => item.id)).toEqual(['fast', 'slow']);
  });

  it('derives the same daily target from the local calendar date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 21, 12, 0, 0));
    const today = getLocalDateKey();
    const daily = new MetaStore().ensureDailyChallenge();

    expect(daily.date).toBe(today);
    expect(daily.seed).toBe(hashString(today));
    expect(daily.targetScore).toBe(CONFIG.DAILY_TARGETS[daily.seed % CONFIG.DAILY_TARGETS.length]);
  });

  it('creates a versioned, reversible run-summary code', () => {
    const store = new MetaStore();
    const replay = { score: 512, mode: 'surge', augments: ['ion_prism'] };
    const code = store.createShareCode(replay);

    expect(code.startsWith(CONFIG.SHARE_CODE_PREFIX)).toBe(true);
    expect(decodeSharePayload(code.slice(CONFIG.SHARE_CODE_PREFIX.length))).toEqual({ v: 2, replay });
  });
});
