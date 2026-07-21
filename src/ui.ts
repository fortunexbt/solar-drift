import { AUGMENT_COLORS, SKINS } from './config';
import { formatTime } from './utils';
import type { Augment, LegacyNeonSnake } from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

type UiElements = {
  startScreen: HTMLElement | null;
  armoryScreen: HTMLElement | null;
  skinScreen: HTMLElement | null;
  augmentScreen: HTMLElement | null;
  pauseMenu: HTMLElement | null;
  gameOverScreen: HTMLElement | null;
  loadingScreen: HTMLElement | null;
  tutorialOverlay: HTMLElement | null;
  gameStatus: HTMLElement | null;
  score: HTMLElement | null;
  combo: HTMLElement | null;
  highScore: HTMLElement | null;
  currentSkin: HTMLElement | null;
  runShards: HTMLElement | null;
  adrenalineFill: HTMLElement | null;
  overdriveState: HTMLElement | null;
  surgeStatus: HTMLElement | null;
  augmentList: HTMLElement | null;
  fpsCounter: HTMLElement | null;
  perfBadge: HTMLElement | null;
  modeGrid: HTMLElement | null;
  modeDesc: HTMLElement | null;
  hudMode: HTMLElement | null;
  leaderboardList: HTMLElement | null;
  leaderboardSubtitle: HTMLElement | null;
  dailyChallengeText: HTMLElement | null;
  dailyChallengeBest: HTMLElement | null;
  playerTagInput: HTMLInputElement | null;
  shareStatus: HTMLElement | null;
  finalScore: HTMLElement | null;
  statTime: HTMLElement | null;
  statCombo: HTMLElement | null;
  statFood: HTMLElement | null;
  statLength: HTMLElement | null;
  statShards: HTMLElement | null;
  metaShards: HTMLElement | null;
  metaLevel: HTMLElement | null;
  upgradeGrid: HTMLElement | null;
  augmentGrid: HTMLElement | null;
  augmentStage: HTMLElement | null;
};

type UiCache = {
  score?: number;
  combo?: number;
  highScore?: number;
  currentSkin?: string;
  runShards?: number;
  metaShards?: number;
  metaLevel?: number;
  adrenaline?: number;
  overdrive?: string;
  surgeStatus?: string;
  fpsVisible?: boolean;
  fpsLabel?: string;
  qualityBadge?: string;
  modeDesc?: string;
  hudMode?: string;
  shareStatus?: string;
  shareStatusSuccess?: boolean;
  augmentKey?: string;
  finalScore?: number;
  statTime?: string;
  statCombo?: number;
  statFood?: number;
  statLength?: number;
  statShards?: number;
};

export class UIManager {
  metaStore: { data: { shards?: number; level?: number } };
  el: UiElements;
  cache: UiCache;

  constructor(metaStore: { data: { shards?: number; level?: number } }) {
    this.metaStore = metaStore;
    this.el = this.cacheElements();
    this.cache = {};
  }

  cacheElements(): UiElements {
    return {
      startScreen: document.getElementById('start-screen'),
      armoryScreen: document.getElementById('armory-screen'),
      skinScreen: document.getElementById('skin-selector-screen'),
      augmentScreen: document.getElementById('augment-screen'),
      pauseMenu: document.getElementById('pause-menu'),
      gameOverScreen: document.getElementById('game-over-screen'),
      loadingScreen: document.getElementById('loading-screen'),
      tutorialOverlay: document.getElementById('tutorial-overlay'),
      gameStatus: document.getElementById('game-status'),
      score: document.getElementById('score'),
      combo: document.getElementById('combo'),
      highScore: document.getElementById('high-score'),
      currentSkin: document.getElementById('current-skin'),
      runShards: document.getElementById('run-shards'),
      adrenalineFill: document.getElementById('adrenaline-fill'),
      overdriveState: document.getElementById('overdrive-state'),
      surgeStatus: document.getElementById('surge-status'),
      augmentList: document.getElementById('augment-list'),
      fpsCounter: document.getElementById('fps-counter'),
      perfBadge: document.getElementById('perf-badge'),
      modeGrid: document.getElementById('mode-grid'),
      modeDesc: document.getElementById('mode-desc'),
      hudMode: document.getElementById('hud-mode'),
      leaderboardList: document.getElementById('leaderboard-list'),
      leaderboardSubtitle: document.getElementById('leaderboard-subtitle'),
      dailyChallengeText: document.getElementById('daily-challenge-text'),
      dailyChallengeBest: document.getElementById('daily-challenge-best'),
      playerTagInput: document.getElementById('player-tag-input') as HTMLInputElement | null,
      shareStatus: document.getElementById('share-status'),
      finalScore: document.getElementById('final-score'),
      statTime: document.getElementById('stat-time'),
      statCombo: document.getElementById('stat-combo'),
      statFood: document.getElementById('stat-food'),
      statLength: document.getElementById('stat-length'),
      statShards: document.getElementById('stat-shards'),
      metaShards: document.getElementById('meta-shards'),
      metaLevel: document.getElementById('meta-level'),
      upgradeGrid: document.getElementById('upgrade-grid'),
      augmentGrid: document.getElementById('augment-grid'),
      augmentStage: document.getElementById('augment-stage')
    };
  }

  showScreen(screen: HTMLElement | null): void {
    const screens = [
      this.el.startScreen,
      this.el.armoryScreen,
      this.el.skinScreen,
      this.el.augmentScreen,
      this.el.pauseMenu,
      this.el.gameOverScreen
    ];
    screens.forEach(el => {
      if (!el) return;
      el.style.display = el === screen ? 'flex' : 'none';
    });
  }

  showLoading(show: boolean): void {
    if (this.el.loadingScreen) {
      this.el.loadingScreen.style.display = show ? 'flex' : 'none';
    }
  }

  announce(message: string): void {
    if (!this.el.gameStatus) return;
    this.el.gameStatus.textContent = '';
    window.setTimeout(() => {
      if (this.el.gameStatus) this.el.gameStatus.textContent = message;
    }, 20);
  }

  updateScore(value: number): void {
    if (this.cache.score === value) return;
    this.cache.score = value;
    if (this.el.score) this.el.score.textContent = value.toString();
  }

  updateCombo(value: number): void {
    if (this.cache.combo === value) return;
    this.cache.combo = value;
    if (this.el.combo) this.el.combo.textContent = value.toString();
  }

  updateHighScore(value: number): void {
    if (this.cache.highScore === value) return;
    this.cache.highScore = value;
    if (this.el.highScore) this.el.highScore.textContent = value.toString();
  }

  updateSkin(name: string): void {
    if (this.cache.currentSkin === name) return;
    this.cache.currentSkin = name;
    if (this.el.currentSkin) this.el.currentSkin.textContent = name.toUpperCase();
  }

  updateRunShards(value: number): void {
    if (this.cache.runShards === value) return;
    this.cache.runShards = value;
    if (this.el.runShards) this.el.runShards.textContent = value.toString();
  }

  updateMeta(): void {
    const shards = this.metaStore.data.shards || 0;
    const level = this.metaStore.data.level || 1;
    if (this.cache.metaShards !== shards) {
      this.cache.metaShards = shards;
      if (this.el.metaShards) this.el.metaShards.textContent = shards.toString();
    }
    if (this.cache.metaLevel !== level) {
      this.cache.metaLevel = level;
      if (this.el.metaLevel) this.el.metaLevel.textContent = level.toString();
    }
  }

  updateAdrenaline(progress: number): void {
    if (!this.el.adrenalineFill) return;
    const pct = Math.max(0, Math.min(1, progress));
    if (this.cache.adrenaline === pct) return;
    this.cache.adrenaline = pct;
    this.el.adrenalineFill.style.width = `${pct * 100}%`;
  }

  updateOverdrive(stateText: string): void {
    if (this.cache.overdrive === stateText) return;
    this.cache.overdrive = stateText;
    if (this.el.overdriveState) this.el.overdriveState.textContent = stateText;
  }

  updateSurgeStatus(text: string): void {
    if (this.cache.surgeStatus === text) return;
    this.cache.surgeStatus = text;
    if (this.el.surgeStatus) this.el.surgeStatus.textContent = text;
  }

  updateAugments(list: Array<{ id: string; name: string; rarity: string }> | null | undefined): void {
    const key = list && list.length > 0 ? list.map(item => item.id).join('|') : 'none';
    if (this.cache.augmentKey === key) return;
    this.cache.augmentKey = key;
    const augmentList = this.el.augmentList;
    if (!augmentList) return;
    augmentList.innerHTML = '';
    if (!list || list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'augment-item';
      empty.textContent = 'NO AUGMENTS';
      augmentList.appendChild(empty);
      return;
    }
    list.forEach(augment => {
      const item = document.createElement('div');
      item.className = `augment-item ${augment.rarity}`;
      item.dataset.augment = augment.id;
      const dot = document.createElement('span');
      dot.className = 'augment-dot';
      dot.style.background = AUGMENT_COLORS[augment.id] || '#2bb3b1';
      dot.style.boxShadow = `0 0 10px ${dot.style.background}`;
      const label = document.createElement('span');
      label.className = 'augment-label';
      label.textContent = augment.name.toUpperCase();
      item.appendChild(dot);
      item.appendChild(label);
      augmentList.appendChild(item);
    });
  }

  renderModeCards(modeDefs: Record<string, { label: string; desc: string }>, currentMode: string, onSelect: (key: string) => void): void {
    const modeGrid = this.el.modeGrid;
    if (!modeGrid) return;
    modeGrid.innerHTML = '';
    Object.entries(modeDefs).forEach(([key, mode]) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mode-card';
      card.dataset.mode = key;
      const isSelected = key === currentMode;
      if (isSelected) card.classList.add('selected');
      card.setAttribute('aria-pressed', isSelected.toString());
      card.setAttribute('aria-label', `${mode.label}: ${mode.desc}`);

      const title = document.createElement('div');
      title.className = 'mode-title';
      title.textContent = mode.label;
      const subtitle = document.createElement('div');
      subtitle.className = 'mode-subtitle';
      subtitle.textContent = mode.desc;

      card.appendChild(title);
      card.appendChild(subtitle);
      card.addEventListener('click', () => onSelect(key));
      modeGrid.appendChild(card);
    });
  }

  updateModeDesc(text: string): void {
    if (this.cache.modeDesc === text) return;
    this.cache.modeDesc = text;
    if (this.el.modeDesc) this.el.modeDesc.textContent = text;
  }

  updateHudMode(text: string): void {
    if (this.cache.hudMode === text) return;
    this.cache.hudMode = text;
    if (this.el.hudMode) this.el.hudMode.textContent = text;
  }

  renderLeaderboard(entries: Array<{ tag?: string; score: number; time?: string; timeMs?: number }>): void {
    const leaderboardList = this.el.leaderboardList;
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    if (!entries || entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'leaderboard-entry';
      empty.textContent = 'NO RUNS YET';
      leaderboardList.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard-entry';

      const left = document.createElement('div');
      const rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = `#${index + 1}`;
      const name = document.createElement('span');
      name.textContent = entry.tag || 'ANON';
      left.appendChild(rank);
      left.appendChild(name);

      const right = document.createElement('div');
      right.className = 'leaderboard-meta';
      const timeLabel = entry.time || formatTime(entry.timeMs || 0);
      right.textContent = `${entry.score} PTS | ${timeLabel}`;

      row.appendChild(left);
      row.appendChild(right);
      leaderboardList.appendChild(row);
    });
  }

  updateDailyChallenge(daily: { targetScore: number; bestScore: number }, useDaily: boolean): void {
    if (this.el.dailyChallengeText) this.el.dailyChallengeText.textContent = `TARGET: ${daily.targetScore} PTS`;
    if (this.el.dailyChallengeBest) this.el.dailyChallengeBest.textContent = `BEST: ${daily.bestScore || 0} PTS`;
    if (this.el.leaderboardSubtitle) this.el.leaderboardSubtitle.textContent = useDaily ? 'TODAY\'S TOP' : 'ALL-TIME TOP';
  }

  updateShareStatus(message: string, isSuccess = true): void {
    if (this.cache.shareStatus === message && this.cache.shareStatusSuccess === isSuccess) return;
    this.cache.shareStatus = message;
    this.cache.shareStatusSuccess = isSuccess;
    if (!this.el.shareStatus) return;
    this.el.shareStatus.textContent = message;
    this.el.shareStatus.style.color = isSuccess ? '#f08a4b' : '#c73a2f';
  }

  renderUpgrades(upgrades: Array<{ id: string; name: string; desc: string; max: number }>, metaStore: { data: { shards: number }; getUpgradeLevel: (id: string) => number; getUpgradeCost: (id: string) => number | null }, onBuy: (id: string) => void): void {
    const upgradeGrid = this.el.upgradeGrid;
    if (!upgradeGrid) return;
    upgradeGrid.innerHTML = '';
    upgrades.forEach(upgrade => {
      const level = metaStore.getUpgradeLevel(upgrade.id);
      const cost = metaStore.getUpgradeCost(upgrade.id);
      const card = document.createElement('div');
      card.className = 'upgrade-card';

      const name = document.createElement('div');
      name.className = 'upgrade-name';
      name.textContent = upgrade.name;

      const desc = document.createElement('div');
      desc.className = 'upgrade-desc';
      desc.textContent = upgrade.desc;

      const meta = document.createElement('div');
      meta.className = 'upgrade-meta';
      meta.textContent = `LEVEL ${level}/${upgrade.max}`;

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'btn btn-secondary';
      action.textContent = cost ? `BUY ${cost}` : 'MAXED';
      action.disabled = !cost || metaStore.data.shards < cost;
      action.addEventListener('click', () => onBuy(upgrade.id));

      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(meta);
      card.appendChild(action);
      upgradeGrid.appendChild(card);
    });
  }

  renderAugmentChoices(choices: Augment[], onPick: (choice: Augment) => void, stage: number): void {
    const augmentGrid = this.el.augmentGrid;
    if (!augmentGrid) return;
    augmentGrid.innerHTML = '';
    if (this.el.augmentStage) this.el.augmentStage.textContent = stage.toString();
    choices.forEach((choice, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `augment-card ${choice.rarity}`;
      card.dataset.augment = choice.id;
      card.dataset.index = index.toString();
      card.setAttribute('aria-label', `Module ${index + 1}: ${choice.name}. ${choice.desc}. ${choice.rarity}.`);
      const sigil = document.createElement('div');
      sigil.className = 'augment-sigil';
      const accent = AUGMENT_COLORS[choice.id] || '#2bb3b1';
      sigil.style.borderColor = accent;
      sigil.style.boxShadow = `0 0 16px ${accent}`;
      card.style.borderColor = `${accent}55`;
      card.style.boxShadow = `0 0 18px ${accent}1f`;
      const keyHint = document.createElement('div');
      keyHint.className = 'augment-index';
      keyHint.textContent = (index + 1).toString();
      const title = document.createElement('div');
      title.className = 'augment-title';
      title.textContent = choice.name;
      const desc = document.createElement('div');
      desc.className = 'augment-desc';
      desc.textContent = choice.desc;
      const rarity = document.createElement('div');
      rarity.className = 'augment-rarity';
      rarity.textContent = choice.rarity.toUpperCase();
      card.appendChild(sigil);
      card.appendChild(keyHint);
      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(rarity);
      card.addEventListener('click', () => onPick(choice));
      augmentGrid.appendChild(card);
    });
  }

  setAugmentSelection(index: number): void {
    if (!this.el.augmentGrid) return;
    const cards = Array.from(this.el.augmentGrid.children) as HTMLElement[];
    cards.forEach((card, idx) => {
      card.classList.toggle('augment-selected', idx === index);
      card.setAttribute('aria-current', idx === index ? 'true' : 'false');
    });
  }

  renderSkinCards(skinManager: { isUnlocked: (key: string) => boolean; currentSkin: string; setSkin: (key: string) => boolean }, onSelect: (key: string) => void): void {
    const skinGrid = document.getElementById('skin-grid');
    if (!skinGrid) return;
    skinGrid.innerHTML = '';
    for (const [key, skin] of Object.entries(SKINS)) {
      const isUnlocked = skinManager.isUnlocked(key);
      const isSelected = skinManager.currentSkin === key;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `skin-card ${!isUnlocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}`;
      card.dataset.skin = key;
      card.disabled = !isUnlocked;
      card.setAttribute('aria-pressed', isSelected.toString());
      card.setAttribute('aria-label', isUnlocked ? `${skin.name} frame${isSelected ? ', selected' : ''}` : `${skin.name} frame, unlocks at ${skin.unlockAt} points`);

      const preview = document.createElement('div');
      preview.className = 'skin-preview';
      preview.style.background = `linear-gradient(135deg, ${skin.preview[0]}, ${skin.preview[1]})`;

      const name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = skin.name;

      card.appendChild(preview);
      card.appendChild(name);

      if (!isUnlocked) {
        const unlock = document.createElement('div');
        unlock.className = 'skin-unlock';
        unlock.textContent = `Unlock at ${skin.unlockAt} pts`;
        card.appendChild(unlock);
      }

      card.addEventListener('click', () => {
        if (isUnlocked) onSelect(key);
      });
      skinGrid.appendChild(card);
    }
  }

  showFps(show: boolean): void {
    if (!this.el.fpsCounter) return;
    if (this.cache.fpsVisible === show) return;
    this.cache.fpsVisible = show;
    this.el.fpsCounter.classList.toggle('visible', show);
  }

  updateFpsLabel(value: number): void {
    const label = `${Math.round(value)} FPS`;
    if (this.cache.fpsLabel === label) return;
    this.cache.fpsLabel = label;
    if (this.el.fpsCounter) this.el.fpsCounter.textContent = label;
  }

  updateQualityBadge(text: string): void {
    if (this.cache.qualityBadge === text) return;
    this.cache.qualityBadge = text;
    if (this.el.perfBadge) {
      this.el.perfBadge.textContent = text;
      this.el.perfBadge.classList.add('active');
    }
  }

  updateGameOverStats(stats: { score: number; length: number; food: number; time: string; combo: number; shards: number }): void {
    if (this.cache.finalScore !== stats.score) {
      this.cache.finalScore = stats.score;
      if (this.el.finalScore) this.el.finalScore.textContent = stats.score.toString();
    }
    if (this.cache.statLength !== stats.length) {
      this.cache.statLength = stats.length;
      if (this.el.statLength) this.el.statLength.textContent = stats.length.toString();
    }
    if (this.cache.statFood !== stats.food) {
      this.cache.statFood = stats.food;
      if (this.el.statFood) this.el.statFood.textContent = stats.food.toString();
    }
    if (this.cache.statTime !== stats.time) {
      this.cache.statTime = stats.time;
      if (this.el.statTime) this.el.statTime.textContent = stats.time;
    }
    if (this.cache.statCombo !== stats.combo) {
      this.cache.statCombo = stats.combo;
      if (this.el.statCombo) this.el.statCombo.textContent = stats.combo.toString();
    }
    if (this.cache.statShards !== stats.shards) {
      this.cache.statShards = stats.shards;
      if (this.el.statShards) this.el.statShards.textContent = stats.shards.toString();
    }
  }
}

if (typeof window !== 'undefined') {
  const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
  NS.UIManager = UIManager;
}
