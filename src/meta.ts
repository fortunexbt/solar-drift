import { CONFIG, SKINS, UPGRADES } from './config';
import { encodeSharePayload, getLocalDateKey, hashString } from './utils';
import type { LegacyNeonSnake, MetaData } from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

export interface PurchaseResult {
  success: boolean;
  reason?: 'missing' | 'max' | 'shards';
}

export class MetaStore {
  data: MetaData;

  constructor() {
    this.data = this.load();
  }

  load(): MetaData {
    const stored = localStorage.getItem(CONFIG.META_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<MetaData> & { version?: number };
        if (parsed && parsed.version === CONFIG.META_VERSION) {
          return parsed as MetaData;
        }
        if (parsed && parsed.version) {
          const migrated = this.migrate(parsed);
          localStorage.setItem(CONFIG.META_STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      } catch (error) {
        return this.defaultData();
      }
    }
    return this.defaultData();
  }

  migrate(previous: Partial<MetaData> & { version?: number }): MetaData {
    const base = this.defaultData();
    const highScore = parseInt(localStorage.getItem('neonSnakeHighScore') || '0', 10);
    const unlocked = localStorage.getItem('neonSnakeUnlockedSkins');
    let unlockedSkins = base.unlockedSkins;
    if (unlocked) {
      try {
        unlockedSkins = JSON.parse(unlocked) as string[];
      } catch (error) {
        unlockedSkins = base.unlockedSkins;
      }
    }
    return {
      ...base,
      playerTag: previous.playerTag || base.playerTag,
      highScore: Math.max(previous.highScore || 0, highScore),
      unlockedSkins: previous.unlockedSkins || unlockedSkins,
      currentSkin: previous.currentSkin || base.currentSkin,
      daily: previous.daily || base.daily,
      leaderboard: previous.leaderboard || base.leaderboard,
      replays: previous.replays || base.replays,
      lastShareCode: previous.lastShareCode || base.lastShareCode,
      xp: previous.xp || base.xp,
      level: previous.level || base.level,
      shards: previous.shards || base.shards,
      upgrades: previous.upgrades || base.upgrades
    };
  }

  defaultData(): MetaData {
    return {
      version: CONFIG.META_VERSION,
      playerTag: '',
      shards: 0,
      xp: 0,
      level: 1,
      highScore: 0,
      upgrades: {},
      unlockedSkins: ['CLASSIC'],
      currentSkin: 'CLASSIC',
      daily: {
        date: '',
        seed: 0,
        targetScore: 0,
        bestScore: 0,
        completedAt: null
      },
      leaderboard: {
        allTime: [],
        daily: {
          date: '',
          entries: []
        }
      },
      replays: [],
      lastShareCode: ''
    };
  }

  save(): void {
    localStorage.setItem(CONFIG.META_STORAGE_KEY, JSON.stringify(this.data));
  }

  getUpgradeLevel(id: string): number {
    return this.data.upgrades[id] || 0;
  }

  getUpgradeCost(id: string): number | null {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade) return null;
    const level = this.getUpgradeLevel(id);
    if (level >= upgrade.max) return null;
    return Math.ceil(upgrade.baseCost * Math.pow(upgrade.costScale, level));
  }

  purchaseUpgrade(id: string): PurchaseResult {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade) return { success: false, reason: 'missing' };
    const level = this.getUpgradeLevel(id);
    if (level >= upgrade.max) return { success: false, reason: 'max' };
    const cost = this.getUpgradeCost(id);
    if (!cost || this.data.shards < cost) return { success: false, reason: 'shards' };
    this.data.shards -= cost;
    this.data.upgrades[id] = level + 1;
    this.save();
    return { success: true };
  }

  addShards(amount: number): void {
    this.data.shards = Math.max(0, (this.data.shards || 0) + amount);
    this.save();
  }

  addXp(amount: number): void {
    this.data.xp = (this.data.xp || 0) + amount;
    this.data.level = Math.floor(Math.sqrt(this.data.xp / 12)) + 1;
    this.save();
  }

  ensureDailyChallenge(): MetaData['daily'] {
    const today = getLocalDateKey();
    if (!this.data.daily || this.data.daily.date !== today) {
      const seed = hashString(today);
      const targetScore = CONFIG.DAILY_TARGETS[seed % CONFIG.DAILY_TARGETS.length];
      this.data.daily = {
        date: today,
        seed,
        targetScore,
        bestScore: 0,
        completedAt: null
      };
      this.data.leaderboard.daily = {
        date: today,
        entries: []
      };
      this.save();
    }
    return this.data.daily;
  }

  addLeaderboardEntry(entries: MetaData['leaderboard']['allTime'], entry: MetaData['leaderboard']['allTime'][number], limit: number): MetaData['leaderboard']['allTime'] {
    const next = [...entries, entry];
    next.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeMs - b.timeMs;
    });
    return next.slice(0, limit);
  }

  createShareCode(replay: unknown): string {
    const payload = { v: 2, replay };
    return `${CONFIG.SHARE_CODE_PREFIX}${encodeSharePayload(payload)}`;
  }
}

export class SkinManager {
  metaStore: MetaStore;
  currentSkin: string;
  unlockedSkins: string[];

  constructor(metaStore: MetaStore) {
    this.metaStore = metaStore;
    this.currentSkin = metaStore.data.currentSkin || 'CLASSIC';
    this.unlockedSkins = metaStore.data.unlockedSkins || ['CLASSIC'];
    if (!this.unlockedSkins.includes(this.currentSkin)) {
      this.currentSkin = 'CLASSIC';
    }
    this.updateColors();
  }

  unlockSkins(score: number): void {
    let newUnlocks = false;
    for (const [key, skin] of Object.entries(SKINS)) {
      if (score >= skin.unlockAt && !this.unlockedSkins.includes(key)) {
        this.unlockedSkins.push(key);
        newUnlocks = true;
      }
    }
    if (newUnlocks) {
      this.metaStore.data.unlockedSkins = this.unlockedSkins;
      this.metaStore.save();
    }
  }

  setSkin(skinKey: string): boolean {
    if (this.unlockedSkins.includes(skinKey)) {
      this.currentSkin = skinKey;
      this.metaStore.data.currentSkin = skinKey;
      this.metaStore.save();
      this.updateColors();
      return true;
    }
    return false;
  }

  getCurrentSkin(): (typeof SKINS)[keyof typeof SKINS] {
    return SKINS[this.currentSkin];
  }

  isUnlocked(skinKey: string): boolean {
    return this.unlockedSkins.includes(skinKey);
  }

  updateColors(): void {
    const skin = SKINS[this.currentSkin];
    const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
    NS.COLORS = {
      snakeHead: skin.head,
      snakeBody: skin.body,
      snakeGlow: skin.glow,
      snakeTrail: skin.trail,
      snakeParticles: skin.particles,
      grid: '#243232',
      gridGlow: '#35504e',
      background: '#0b0d0f'
    };
  }

  getSkinColors(): (typeof SKINS)[keyof typeof SKINS] {
    return SKINS[this.currentSkin];
  }
}

if (typeof window !== 'undefined') {
  const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
  NS.MetaStore = MetaStore;
  NS.SkinManager = SkinManager;
}
