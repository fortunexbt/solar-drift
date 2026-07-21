import { CONFIG, MODE_DEFS, QUALITY_TIERS, AUGMENTS, AUGMENT_COLORS, UPGRADES } from './config';
import { clamp, decodeSharePayload, easeOutCubic, formatTime, getLocalDateKey, hexToRgb, rgbToRgba, shuffle } from './utils';
import { Vector2D } from './core';
import { GlowRenderer, Grid, NeonBackdrop, PostFxRenderer, PulseSystem, ScreenShake, SkylineLayer } from './render';
import { ParticleSystem } from './particles';
import { MetaStore, SkinManager } from './meta';
import { SoundManager } from './audio';
import { UIManager } from './ui';
import { InputManager } from './input';
import { Food, Hazard, PowerUp, Snake } from './entities';
import type { Augment, LeaderboardEntry, LegacyNeonSnake, ModeDef, ReplayData } from './types';

declare global {
    interface Window {
        NeonSnake?: Partial<LegacyNeonSnake>;
        render_game_to_text?: () => string;
        advanceTime?: (ms: number) => void;
    }
}

type RunMode = 'standard' | 'daily';

const GUIDE_STORAGE_KEY = 'solarDriftGuideSeen';

const parseRunSummary = (value: unknown, fallbackId: string): ReplayData | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    const {
        id,
        createdAt,
        mode,
        score,
        durationMs,
        maxCombo,
        foodEaten,
        length,
        augments,
        shards,
        shareCode
    } = candidate;
    const numericValues = [createdAt, score, durationMs, maxCombo, foodEaten, length, shards];
    if (!numericValues.every(item => typeof item === 'number' && Number.isFinite(item) && item >= 0)) return null;
    if (typeof mode !== 'string' || !Array.isArray(augments) || !augments.every(item => typeof item === 'string')) return null;

    return {
        id: typeof id === 'string' && id ? id : fallbackId,
        createdAt: createdAt as number,
        mode,
        score: score as number,
        durationMs: durationMs as number,
        maxCombo: maxCombo as number,
        foodEaten: foodEaten as number,
        length: length as number,
        augments: augments as string[],
        shards: shards as number,
        ...(typeof shareCode === 'string' ? { shareCode } : {})
    };
};

type RunModifiers = {
    scoreMultiplier: number;
    comboWindowBonus: number;
    comboMaxBonusBonus: number;
    powerupChanceBonus: number;
    magnetRangeBonus: number;
    reviveChargesBonus: number;
    reviveGhostBonusMs: number;
    overdriveDurationBonus: number;
    overdriveFillBonus: number;
    overdriveScoreMultiplier: number;
    nearMissBonus: number;
    nearMissShardBonus: number;
    gateRewardBonus: number;
    gateChainBonus: number;
    gateShardBonus: number;
    surgeCooldownScale: number;
    surgeScoreBoost: number;
    powerupShardBonus: number;
    powerupExtendOverdrive: number;
    hazardMaxBonus: number;
    volatileBonus: number;
    volatileShardBonus: number;
    magnetPowerup: boolean;
};

type RunStats = {
    startLength: number;
    reviveCharges: number;
    powerChance: number;
    comboWindow: number;
    magnetRange: number;
    surgeCharges: number;
    overdriveDurationMs: number;
    scoreMultiplier: number;
    nearMissBonus: number;
    nearMissShardBonus: number;
    gateRewardBonus: number;
    gateChainBonus: number;
    gateShardBonus: number;
    surgeCooldownScale: number;
    surgeScoreBoost: number;
    powerupShardBonus: number;
    powerupExtendOverdrive: number;
    hazardMaxBonus: number;
    volatileBonus: number;
    volatileShardBonus: number;
    magnetPowerup: boolean;
    volatileTtlMs: number;
    foodWeights: Record<string, number>;
};

type AugmentState = {
    lumenActiveMs: number;
    lumenTickMs: number;
    prismEchoActiveMs: number;
    prismEchoCount: number;
    kaleidoSurgeBudgetMs: number;
    overdriveBonusBudgetMs: number;
    magnetBloomActiveMs: number;
    magnetBloomNextCombo: number;
    prismCoilActiveMs: number;
    prismCoilCount: number;
    gatecrashBloomCount: number;
    chromaticAegisCharges: number;
    aegisShardCounter: number;
    photonWeaveTimerMs: number;
    photonWeaveStacks: number;
    photonWeaveBoostMs: number;
    signatureEnabled: boolean;
    signatureScoreBonus: number;
};

type GateReward = {
    position: Vector2D;
    expiresAt: number;
};

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    glowRenderer: GlowRenderer;
    postFx: PostFxRenderer;
    screenShake: ScreenShake;
    grid: Grid;
    backdrop: NeonBackdrop;
    skyline: SkylineLayer;
    pulses: PulseSystem;
    particles: ParticleSystem;

    metaStore: MetaStore;
    skinManager: SkinManager;
    soundManager: SoundManager;
    ui: UIManager;

    modeKey: string;
    mode: ModeDef;
    qualityMode: string;
    qualityTier: number;
    autoQuality: boolean;
    qualityLockMs: number;

    isRunning: boolean;
    isPaused: boolean;
    lastTime: number;
    elapsedTimeMs: number;

    score: number;
    highScore: number;
    foodEaten: number;
    comboCount: number;
    maxCombo: number;
    lastEatTime: number;
    lastNearMissAt: number;
    lastMusicUpdate: number;

    runMode: RunMode;
    runId: string | null;
    runShards: number;
    reviveCharges: number;
    reviveGhostMs: number;
    reviveGraceMs: number;

    surgeCharges: number;
    surgeCooldownMs: number;
    surgeRemainingMs: number;
    surgeLockMs: number;
    surgeScoreBoostMs: number;

    adrenaline: number;
    overdriveActive: boolean;
    overdriveRemainingMs: number;
    overdriveDurationMs: number;

    hazards: Hazard[];
    gateRewards: GateReward[];
    powerUp: PowerUp | null;
    food: Food;
    snake: Snake | null;

    activeAugments: Augment[];
    availableAugments: Augment[];
    nextAugmentAt: number;
    augmentStage: number;
    activeAugmentFlags: Record<string, boolean>;
    augmentState: AugmentState;
    augmentSelectionActive: boolean;
    augmentSelectionIndex: number;
    augmentSelectionChoices: Augment[];
    augmentSelectionHandler: (event: KeyboardEvent) => void;

    showFps: boolean;
    fpsSamples: number[];
    lastFpsUpdate: number;

    flashAlpha: number;
    flashColor: { r: number; g: number; b: number };
    input: InputManager | null;
    guideReturnFocus: HTMLElement | null;

    runModifiers!: RunModifiers;
    runStats!: RunStats;
    comboWindowMs!: number;
    powerupChance!: number;
    gridScanlines = true;
    animationFrameId: number | null = null;
    manualTimeMode = false;

        constructor() {
            const canvas = document.getElementById('game-canvas');
            if (!(canvas instanceof HTMLCanvasElement)) {
                throw new Error('Game canvas not found');
            }
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Canvas context not available');
            }
            this.canvas = canvas;
            this.ctx = context;
            this.manualTimeMode = new URLSearchParams(window.location.search).has('playtest');

            this.setupCanvas();

            this.glowRenderer = new GlowRenderer(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            this.postFx = new PostFxRenderer(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            this.screenShake = new ScreenShake();
            this.grid = new Grid(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, CONFIG.GRID_SIZE);
            this.backdrop = new NeonBackdrop(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            this.skyline = new SkylineLayer(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            this.pulses = new PulseSystem();
            this.particles = new ParticleSystem();

            this.metaStore = new MetaStore();
            this.skinManager = new SkinManager(this.metaStore);
            this.soundManager = new SoundManager();
            this.ui = new UIManager(this.metaStore);
            document.addEventListener('pointerdown', () => this.soundManager.unlock(), { once: true, capture: true });
            document.addEventListener('keydown', () => this.soundManager.unlock(), { once: true, capture: true });
            document.addEventListener('click', () => this.soundManager.unlock(), { once: true, capture: true });

            this.modeKey = localStorage.getItem('neonSnakeMode') || CONFIG.DEFAULT_MODE;
            this.mode = MODE_DEFS[this.modeKey] || MODE_DEFS[CONFIG.DEFAULT_MODE];

            this.qualityMode = localStorage.getItem('neonSnakeQualityMode') || 'AUTO';
            this.qualityTier = CONFIG.TUNING.quality.defaultTier;
            this.autoQuality = this.qualityMode === 'AUTO';
            this.qualityLockMs = 0;
            this.applyQualityTier(this.autoQuality ? CONFIG.TUNING.quality.defaultTier : this.getQualityTierFromMode());

            this.isRunning = false;
            this.isPaused = false;
            this.lastTime = 0;
            this.elapsedTimeMs = 0;

            this.score = 0;
            this.highScore = this.metaStore.data.highScore || 0;
            this.foodEaten = 0;
            this.comboCount = 0;
            this.maxCombo = 0;
            this.lastEatTime = 0;
            this.lastNearMissAt = 0;
            this.lastMusicUpdate = 0;

            this.runMode = 'standard';
            this.runId = null;
            this.runShards = 0;
            this.reviveCharges = 0;
            this.reviveGhostMs = 0;
            this.reviveGraceMs = 0;

            this.surgeCharges = 0;
            this.surgeCooldownMs = 0;
            this.surgeRemainingMs = 0;
            this.surgeLockMs = 0;
            this.surgeScoreBoostMs = 0;

            this.adrenaline = 0;
            this.overdriveActive = false;
            this.overdriveRemainingMs = 0;
            this.overdriveDurationMs = CONFIG.OVERDRIVE.durationMs;

            this.hazards = [];
            this.gateRewards = [];
            this.powerUp = null;
            this.food = new Food(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, CONFIG.GRID_SIZE);
            this.snake = null;

            this.activeAugments = [];
            this.availableAugments = shuffle(AUGMENTS);
            this.nextAugmentAt = CONFIG.AUGMENT_STEP_START;
            this.augmentStage = 0;
            this.activeAugmentFlags = {};
            this.augmentState = this.createAugmentState();
            this.augmentSelectionActive = false;
            this.augmentSelectionIndex = 0;
            this.augmentSelectionChoices = [];
            this.ui.setAugmentSelection(-1);
            this.augmentSelectionActive = false;
            this.augmentSelectionIndex = 0;
            this.augmentSelectionChoices = [];
            this.augmentSelectionHandler = this.handleAugmentSelectionKeyDown.bind(this);

            this.showFps = false;
            this.fpsSamples = [];
            this.lastFpsUpdate = 0;

            this.flashAlpha = 0;
            this.flashColor = hexToRgb('#2bb3b1');
            this.input = null;
            this.guideReturnFocus = null;

            this.setupInput();
            this.setupUiEvents();
            this.setupModeSelector();
            this.setupSkinSelector();
            this.applyMode(this.modeKey);
            this.refreshMetaUI();
            this.updateHighScoreDisplay();
            this.updateSkinDisplay();
            this.initLoadingScreen();
            window.addEventListener('keydown', this.augmentSelectionHandler);
        }

        setupCanvas(): void {
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const aspectRatio = CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT;
            const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
            const controlsReserve = isCoarsePointer && windowWidth <= 900 ? 176 : 0;
            const padding = CONFIG.TUNING.canvas.displayPadding;

            let displayWidth = windowWidth - padding;
            let displayHeight = displayWidth / aspectRatio;

            if (displayHeight > windowHeight - padding - controlsReserve) {
                displayHeight = Math.max(220, windowHeight - padding - controlsReserve);
                displayWidth = displayHeight * aspectRatio;
            }

            this.canvas.style.width = `${displayWidth}px`;
            this.canvas.style.height = `${displayHeight}px`;
            this.canvas.width = CONFIG.CANVAS_WIDTH;
            this.canvas.height = CONFIG.CANVAS_HEIGHT;
        }

        setupInput(): void {
            this.input = new InputManager(this.canvas, {
                onDirection: (direction: Vector2D) => this.handleDirectionInput(direction),
                onTogglePause: () => this.togglePause(),
                onSurge: () => this.activateSurge(),
                onToggleFps: () => this.toggleFps(),
                onToggleSound: () => this.toggleSound()
            });
            this.input.setEnabled(this.isRunning);
            this.input.setPaused(this.isPaused);
            window.addEventListener('resize', () => this.setupCanvas());
        }

        setupUiEvents(): void {
            const bind = (id: string, handler: () => void): void => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', handler);
            };

            bind('start-btn', () => {
                this.soundManager.playUi('confirm');
                this.start('standard');
            });
            bind('daily-challenge-btn', () => {
                this.soundManager.playUi('confirm');
                this.start('daily');
            });
            bind('skins-btn', () => {
                this.soundManager.playUi();
                this.showSkinSelector();
            });
            bind('armory-btn', () => {
                this.soundManager.playUi();
                this.showArmory();
            });
            bind('back-to-start-btn', () => {
                this.soundManager.playUi();
                this.showStartScreen();
            });
            bind('armory-back-btn', () => {
                this.soundManager.playUi();
                this.showStartScreen();
            });
            bind('skins-from-gameover-btn', () => {
                this.soundManager.playUi();
                this.showSkinSelector();
            });
            bind('restart-btn', () => {
                this.soundManager.playUi('confirm');
                this.restart();
            });
            bind('resume-btn', () => {
                this.soundManager.playUi('confirm');
                this.togglePause(false);
            });
            bind('pause-btn', () => {
                this.soundManager.playUi();
                this.togglePause();
            });
            bind('restart-pause-btn', () => {
                this.soundManager.playUi('confirm');
                this.restart();
            });
            bind('sound-btn', () => {
                this.soundManager.playUi();
                this.toggleSound();
            });
            bind('pause-fullscreen-btn', () => {
                this.soundManager.playUi();
                this.toggleFullscreen();
            });
            bind('quality-btn', () => {
                this.soundManager.playUi();
                this.toggleQualityMode();
            });
            bind('quit-btn', () => {
                this.soundManager.playUi();
                this.quitToStart();
            });
            bind('mute-btn', () => {
                this.soundManager.playUi();
                this.toggleSound();
            });
            bind('fullscreen-btn', () => {
                this.soundManager.playUi();
                this.toggleFullscreen();
            });
            bind('guide-btn', () => {
                this.soundManager.playUi();
                this.showGuide();
            });
            bind('guide-close-btn', () => {
                this.soundManager.playUi('confirm');
                this.closeGuide();
            });
            bind('import-share-btn', () => {
                this.soundManager.playUi();
                this.importShareCode();
            });
            bind('copy-share-btn', () => {
                this.soundManager.playUi();
                this.copyLastShareCode();
            });
            bind('copy-share-gameover-btn', () => {
                this.soundManager.playUi();
                this.copyLastShareCode();
            });

            const playerTagInput = document.getElementById('player-tag-input');
            if (playerTagInput instanceof HTMLInputElement) {
                playerTagInput.value = this.metaStore.data.playerTag || '';
                playerTagInput.addEventListener('input', (event: Event) => {
                    const target = event.target;
                    if (!(target instanceof HTMLInputElement)) return;
                    const sanitized = target.value.toUpperCase()
                        .replace(/[^A-Z0-9_-]/g, '')
                        .slice(0, CONFIG.TUNING.ui.playerTagMaxLength);
                    target.value = sanitized;
                    this.metaStore.data.playerTag = sanitized;
                    this.metaStore.save();
                });
            }

            window.addEventListener('keydown', (event: KeyboardEvent) => {
                const guide = document.getElementById('guide-screen');
                if (guide?.style.display !== 'flex') return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.closeGuide();
                } else if (event.key === 'Tab') {
                    event.preventDefault();
                    document.getElementById('guide-close-btn')?.focus();
                }
            });
        }

        setTouchControlsVisible(visible: boolean): void {
            const controls = document.getElementById('touch-controls');
            if (!controls) return;
            controls.toggleAttribute('hidden', !visible);
            controls.setAttribute('aria-hidden', (!visible).toString());
        }

        showGuide(): void {
            const guide = document.getElementById('guide-screen');
            const startScreen = document.getElementById('start-screen');
            const canvas = document.getElementById('game-canvas');
            const uiLayer = document.getElementById('ui-layer');
            if (!guide) return;
            this.guideReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            guide.style.display = 'flex';
            guide.setAttribute('aria-hidden', 'false');
            if (startScreen) startScreen.inert = true;
            if (canvas) canvas.inert = true;
            if (uiLayer) uiLayer.inert = true;
            window.setTimeout(() => document.getElementById('guide-close-btn')?.focus(), 0);
            this.ui.announce('Flight manual opened.');
        }

        closeGuide(): void {
            const guide = document.getElementById('guide-screen');
            const startScreen = document.getElementById('start-screen');
            const canvas = document.getElementById('game-canvas');
            const uiLayer = document.getElementById('ui-layer');
            if (!guide) return;
            guide.style.display = 'none';
            guide.setAttribute('aria-hidden', 'true');
            if (startScreen) startScreen.inert = false;
            if (canvas) canvas.inert = false;
            if (uiLayer) uiLayer.inert = false;
            localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
            const returnTarget = this.guideReturnFocus || document.getElementById('guide-btn');
            this.guideReturnFocus = null;
            returnTarget?.focus();
            this.ui.announce('Flight manual closed. Choose a mode and begin the drift.');
        }

        setupModeSelector(): void {
            this.ui.renderModeCards(MODE_DEFS, this.modeKey, (key: string) => {
                this.soundManager.playUi();
                this.applyMode(key);
                this.updateModeUI();
            });
            this.updateModeUI();
        }

        setupSkinSelector(): void {
            const renderSkins = (): void => {
                this.ui.renderSkinCards(this.skinManager, (key: string) => {
                    this.skinManager.setSkin(key);
                    this.updateSkinDisplay();
                    renderSkins();
                });
            };
            renderSkins();
        }

        applyMode(modeKey: string): void {
            this.modeKey = MODE_DEFS[modeKey] ? modeKey : CONFIG.DEFAULT_MODE;
            this.mode = MODE_DEFS[this.modeKey] || MODE_DEFS[CONFIG.DEFAULT_MODE];
            localStorage.setItem('neonSnakeMode', this.modeKey);
            if (this.food) {
                this.food.setWeights(this.mode.foodWeights);
                this.food.setVolatileTtl(this.mode.volatile?.ttlMs || 0);
            }
            if (this.snake) {
                this.updateSpeedCurve();
            }
        }

        updateModeUI(): void {
            this.ui.updateModeDesc(this.mode.desc);
            this.ui.updateHudMode(this.mode.label);
            this.ui.renderModeCards(MODE_DEFS, this.modeKey, (key: string) => {
                this.soundManager.playUi();
                this.applyMode(key);
                this.updateModeUI();
            });
        }

        initLoadingScreen(): void {
            const loadingScreen = document.getElementById('loading-screen');
            const progressBar = document.getElementById('loading-progress');
            const loadingText = document.getElementById('loading-text');
            const { progressStep, stepDelayMs, startDelayMs, maxProgress } = CONFIG.TUNING.loading;
            const steps = [
                'INITIALIZING CORE...',
                'SYNCING NEON GRID...',
                'LOADING ARMORY...',
                'STABILIZING DRIVES...',
                'READY'
            ];
            let progress = 0;
            let stepIndex = 0;

            const tick = (): void => {
                progress += progressStep;
                stepIndex = Math.min(stepIndex + 1, steps.length - 1);
                if (progressBar) {
                    progressBar.style.width = `${progress}%`;
                    progressBar.parentElement?.setAttribute('aria-valuenow', String(Math.min(progress, 100)));
                }
                if (loadingText) loadingText.textContent = steps[stepIndex];
                if (progress >= maxProgress) {
                    if (loadingScreen) loadingScreen.style.display = 'none';
                    this.showStartScreen();
                    if (!this.manualTimeMode && !localStorage.getItem(GUIDE_STORAGE_KEY)) {
                        this.showGuide();
                    }
                } else {
                    setTimeout(tick, stepDelayMs);
                }
            };

            setTimeout(tick, startDelayMs);
        }

        applyQualityTier(tier: number): void {
            const clamped = clamp(tier, 0, QUALITY_TIERS.length - 1);
            this.qualityTier = clamped;
            const quality = QUALITY_TIERS[clamped];
            this.glowRenderer.setQuality(quality);
            this.postFx.setQuality(quality);
            this.backdrop.createOrbs(quality.backdropOrbs);
            this.skyline.build(!quality.bloom);
            this.particles.setLimit(Math.floor(CONFIG.TUNING.quality.particleBaseLimit * quality.particleScale));
            this.gridScanlines = quality.scanlines;
            this.ui.updateQualityBadge(`RENDER: ${this.autoQuality ? 'AUTO' : quality.name}`);
            const qualityBtn = document.getElementById('quality-btn');
            if (qualityBtn) {
                qualityBtn.textContent = `RENDER: ${this.autoQuality ? 'AUTO' : quality.name}`;
            }
        }

        getQualityTierFromMode(): number {
            switch (this.qualityMode) {
                case 'ULTRA':
                    return 0;
                case 'NORMAL':
                    return 1;
                case 'LOW':
                    return 2;
                case 'BATTERY':
                    return 3;
                default:
                    return 1;
            }
        }

        toggleQualityMode(): void {
            const modes = ['AUTO', 'ULTRA', 'NORMAL', 'LOW', 'BATTERY'];
            const currentIndex = modes.indexOf(this.qualityMode);
            const nextMode = modes[(currentIndex + 1) % modes.length];
            this.qualityMode = nextMode;
            localStorage.setItem('neonSnakeQualityMode', this.qualityMode);
            this.autoQuality = this.qualityMode === 'AUTO';
            if (this.autoQuality) {
                this.applyQualityTier(this.qualityTier);
            } else {
                this.applyQualityTier(this.getQualityTierFromMode());
            }
        }

        handleDirectionInput(direction: Vector2D): void {
            if (!this.snake) return;
            if (this.surgeLockMs > 0) return;
            this.snake.setDirection(direction);
        }

        start(mode: RunMode = 'standard'): void {
            this.metaStore.ensureDailyChallenge();
            this.runMode = mode;
            this.soundManager.init();
            this.soundManager.playGameMusic();
            this.soundManager.setPauseDucking(false);
            this.ui.showScreen(null);
            this.reset();
            this.isRunning = true;
            this.isPaused = false;
            this.updatePauseUI();
            this.setTouchControlsVisible(true);
            if (this.input) {
                this.input.setEnabled(true);
                this.input.setPaused(false);
            }
            this.ui.announce(`${this.mode.label} started. Use arrow keys or W A S D to steer, Shift to boost, and Space to pause.`);
            this.canvas.focus();
            this.startAnimationLoop();
        }

        restart(): void {
            this.soundManager.playGameMusic();
            this.soundManager.setPauseDucking(false);
            this.ui.showScreen(null);
            this.reset();
            this.isRunning = true;
            this.isPaused = false;
            this.updatePauseUI();
            this.setTouchControlsVisible(true);
            if (this.input) {
                this.input.setEnabled(true);
                this.input.setPaused(false);
            }
            this.ui.announce('Run restarted.');
            this.canvas.focus();
            this.startAnimationLoop();
        }

        reset(): void {
            const startX = Math.floor((CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE) / 2);
            const startY = Math.floor((CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE) / 2);
            const skinColors = this.skinManager.getSkinColors();

            this.elapsedTimeMs = 0;
            this.runModifiers = this.createRunModifiers();
            this.runStats = this.buildRunStats();

            this.snake = new Snake(startX, startY, CONFIG.GRID_SIZE, skinColors, this.runStats.startLength);
            this.food = new Food(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, CONFIG.GRID_SIZE);
            this.food.setWeights(this.runStats.foodWeights);
            this.food.setVolatileTtl(this.runStats.volatileTtlMs);
            this.food.respawn(this.elapsedTimeMs);
            this.powerUp = null;

            this.particles = new ParticleSystem();
            this.pulses = new PulseSystem();
            this.flashAlpha = 0;

            this.score = 0;
            this.runShards = 0;
            this.foodEaten = 0;
            this.lastEatTime = 0;
            this.comboCount = 0;
            this.maxCombo = 0;
            this.lastNearMissAt = 0;
            this.lastMusicUpdate = 0;

            this.hazards = [];
            this.gateRewards = [];
            this.runId = this.generateRunId();
            this.activeAugments = [];
            this.availableAugments = shuffle(AUGMENTS);
            this.nextAugmentAt = CONFIG.AUGMENT_STEP_START;
            this.augmentStage = 0;
            this.activeAugmentFlags = {};
            this.augmentState = this.createAugmentState();

            this.reviveCharges = this.runStats.reviveCharges;
            this.reviveGhostMs = 0;
            this.reviveGraceMs = 0;

            this.surgeCharges = this.runStats.surgeCharges;
            this.surgeCooldownMs = 0;
            this.surgeRemainingMs = 0;
            this.surgeLockMs = 0;
            this.surgeScoreBoostMs = 0;

            this.adrenaline = 0;
            this.overdriveActive = false;
            this.overdriveRemainingMs = 0;
            this.overdriveDurationMs = this.runStats.overdriveDurationMs;

            this.updateScoreDisplay();
            this.updateComboDisplay();
            this.ui.updateRunShards(this.runShards);
            this.ui.updateAdrenaline(0);
            this.ui.updateOverdrive('CHARGE');
            this.ui.updateSurgeStatus(`SURGE ${this.surgeCharges} | 0s`);
            this.ui.updateAugments(this.activeAugments);
            this.updateSoundUI();
            this.applyRunStats();
        }

        createRunModifiers(): RunModifiers {
            return {
                scoreMultiplier: 1,
                comboWindowBonus: 0,
                comboMaxBonusBonus: 0,
                powerupChanceBonus: 0,
                magnetRangeBonus: 0,
                reviveChargesBonus: 0,
                reviveGhostBonusMs: 0,
                overdriveDurationBonus: 0,
                overdriveFillBonus: 0,
                overdriveScoreMultiplier: 1,
                nearMissBonus: 0,
                nearMissShardBonus: 0,
                gateRewardBonus: 0,
                gateChainBonus: 0,
                gateShardBonus: 0,
                surgeCooldownScale: 1,
                surgeScoreBoost: 0,
                powerupShardBonus: 0,
                powerupExtendOverdrive: 0,
                hazardMaxBonus: 0,
                volatileBonus: 0,
                volatileShardBonus: 0,
                magnetPowerup: false
            };
        }

        createAugmentState(): AugmentState {
            return {
                lumenActiveMs: 0,
                lumenTickMs: 0,
                prismEchoActiveMs: 0,
                prismEchoCount: 0,
                kaleidoSurgeBudgetMs: 0,
                overdriveBonusBudgetMs: 0,
                magnetBloomActiveMs: 0,
                magnetBloomNextCombo: CONFIG.TUNING.augmentTiming.magnetBloomComboStep,
                prismCoilActiveMs: 0,
                prismCoilCount: 0,
                gatecrashBloomCount: 0,
                chromaticAegisCharges: 0,
                aegisShardCounter: 0,
                photonWeaveTimerMs: 0,
                photonWeaveStacks: 0,
                photonWeaveBoostMs: 0,
                signatureEnabled: false,
                signatureScoreBonus: 0
            };
        }

        getAugmentColor(id: string): string {
            return AUGMENT_COLORS[id] || '#2bb3b1';
        }

        emitAugmentPulse(id: string, x: number, y: number, maxRadius: number, duration: number, thickness?: number): void {
            this.pulses.emit(x, y, this.getAugmentColor(id), maxRadius, duration, thickness);
        }

        emitSignaturePulse(id: string, x: number, y: number, maxRadius: number, duration: number, thickness?: number): void {
            if (!this.augmentState.signatureEnabled) return;
            this.emitAugmentPulse(id, x, y, maxRadius, duration, thickness);
        }

        addShards(amount: number): void {
            if (!amount) return;
            this.runShards += amount;
            if (this.activeAugmentFlags.chromatic_aegis) {
                const state = this.augmentState;
                const { chromaticAegisShardStep, chromaticAegisMaxCharges } = CONFIG.TUNING.augmentTiming;
                const fx = CONFIG.TUNING.fx;
                state.aegisShardCounter += amount;
                const maxCharges = chromaticAegisMaxCharges;
                while (state.aegisShardCounter >= chromaticAegisShardStep && state.chromaticAegisCharges < maxCharges) {
                    state.aegisShardCounter -= chromaticAegisShardStep;
                    state.chromaticAegisCharges += 1;
                    const head = this.snake ? this.snake.getHead() : null;
                    if (head) {
                        const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                        const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                        const pulse = fx.pulses.chromaticAegisGain;
                        this.emitAugmentPulse('chromatic_aegis', x, y, pulse.radius, pulse.duration, pulse.thickness);
                        this.triggerFlash(this.getAugmentColor('chromatic_aegis'), fx.flashes.chromaticAegisGain);
                    }
                }
                if (state.chromaticAegisCharges >= maxCharges && state.aegisShardCounter > chromaticAegisShardStep - 1) {
                    state.aegisShardCounter = chromaticAegisShardStep - 1;
                }
            }
        }

        buildRunStats(): RunStats {
            const upgrades = this.metaStore.data.upgrades || {};
            const startLength = 1 + (upgrades.startLength || 0);
            const reviveCharges = upgrades.aegis || 0;
            const powerChance = (this.mode.powerups?.chance || CONFIG.POWERUP_SPAWN_CHANCE) + (upgrades.flux || 0) * CONFIG.TUNING.upgrades.fluxPowerupChance;
            const comboWindow = (this.mode.combo.window || CONFIG.COMBO_WINDOW) + (upgrades.combo || 0) * CONFIG.TUNING.upgrades.comboWindowMs;
            const magnetRange = CONFIG.MAGNET_RANGE + (upgrades.magnet || 0);
            const surgeCharges = 1 + (upgrades.surge || 0);
            const overdriveDurationMs = CONFIG.OVERDRIVE.durationMs + (upgrades.overdrive || 0) * CONFIG.TUNING.upgrades.overdriveDurationMs;

            return {
                startLength,
                reviveCharges: reviveCharges + this.runModifiers.reviveChargesBonus,
                powerChance: powerChance + this.runModifiers.powerupChanceBonus,
                comboWindow: comboWindow + this.runModifiers.comboWindowBonus,
                magnetRange: magnetRange + this.runModifiers.magnetRangeBonus,
                surgeCharges,
                overdriveDurationMs: overdriveDurationMs + this.runModifiers.overdriveDurationBonus,
                scoreMultiplier: this.runModifiers.scoreMultiplier,
                nearMissBonus: this.runModifiers.nearMissBonus,
                nearMissShardBonus: this.runModifiers.nearMissShardBonus,
                gateRewardBonus: this.runModifiers.gateRewardBonus,
                gateChainBonus: this.runModifiers.gateChainBonus,
                gateShardBonus: this.runModifiers.gateShardBonus,
                surgeCooldownScale: this.runModifiers.surgeCooldownScale,
                surgeScoreBoost: this.runModifiers.surgeScoreBoost,
                powerupShardBonus: this.runModifiers.powerupShardBonus,
                powerupExtendOverdrive: this.runModifiers.powerupExtendOverdrive,
                hazardMaxBonus: this.runModifiers.hazardMaxBonus,
                volatileBonus: this.runModifiers.volatileBonus,
                volatileShardBonus: this.runModifiers.volatileShardBonus,
                magnetPowerup: this.runModifiers.magnetPowerup,
                volatileTtlMs: this.mode.volatile?.ttlMs || 0,
                foodWeights: { ...this.mode.foodWeights }
            };
        }

        applyRunStats(): void {
            if (!this.snake) return;
            this.snake.baseMagnetRange = this.runStats.magnetRange * CONFIG.GRID_SIZE;
            this.snake.setExternalModifiers({ score: this.runStats.scoreMultiplier });
            this.comboWindowMs = this.runStats.comboWindow;
            this.powerupChance = clamp(
                this.runStats.powerChance,
                CONFIG.TUNING.powerupChanceClamp.min,
                CONFIG.TUNING.powerupChanceClamp.max
            );
        }

        updateAugmentEffects(deltaTime: number): void {
            const state = this.augmentState;
            if (state.lumenActiveMs > 0) {
                state.lumenActiveMs = Math.max(0, state.lumenActiveMs - deltaTime);
                state.lumenTickMs -= deltaTime;
                if (state.lumenTickMs <= 0 && this.snake) {
                    const head = this.snake.getHead();
                    const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    this.particles.emitTrail(x, y, this.getAugmentColor('lumen_relay'));
                    state.lumenTickMs = CONFIG.TUNING.augmentTiming.lumenTickMs;
                }
            }

            if (state.prismEchoActiveMs > 0) {
                state.prismEchoActiveMs = Math.max(0, state.prismEchoActiveMs - deltaTime);
            }

            if (state.magnetBloomActiveMs > 0) {
                state.magnetBloomActiveMs = Math.max(0, state.magnetBloomActiveMs - deltaTime);
            }

            if (state.prismCoilActiveMs > 0) {
                state.prismCoilActiveMs = Math.max(0, state.prismCoilActiveMs - deltaTime);
            }

            if (this.activeAugmentFlags.photon_weave) {
                state.photonWeaveTimerMs += deltaTime;
                if (state.photonWeaveTimerMs >= CONFIG.TUNING.augmentTiming.photonWeaveIntervalMs) {
                    state.photonWeaveTimerMs = 0;
                    state.photonWeaveStacks = Math.min(
                        CONFIG.TUNING.augmentTiming.photonWeaveMaxStacks,
                        state.photonWeaveStacks + 1
                    );
                    if (this.snake) {
                        const pulse = CONFIG.TUNING.fx.pulses.photonWeaveGain;
                        const head = this.snake.getHead();
                        const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                        const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                        this.emitAugmentPulse('photon_weave', x, y, pulse.radius, pulse.duration, pulse.thickness);
                    }
                }
            }

            if (state.photonWeaveBoostMs > 0) {
                state.photonWeaveBoostMs = Math.max(0, state.photonWeaveBoostMs - deltaTime);
            }
        }

        tryAegisShield(head: Vector2D, reason: string): boolean {
            if (!this.activeAugmentFlags.chromatic_aegis) return false;
            const state = this.augmentState;
            if (state.chromaticAegisCharges <= 0) return false;
            state.chromaticAegisCharges -= 1;
            this.reviveGraceMs = Math.max(this.reviveGraceMs, CONFIG.TUNING.revive.aegisGraceMs);
            this.updateExternalModifiers();
            const pulse = CONFIG.TUNING.fx.pulses.chromaticAegisShield;
            const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            this.emitAugmentPulse('chromatic_aegis', x, y, pulse.radius, pulse.duration, pulse.thickness);
            this.triggerFlash(this.getAugmentColor('chromatic_aegis'), CONFIG.TUNING.fx.flashes.chromaticAegisShield);
            this.screenShake.small();
            return true;
        }

        consumePhotonWeaveBoost(): void {
            if (!this.activeAugmentFlags.photon_weave) return;
            const state = this.augmentState;
            if (state.photonWeaveStacks <= 0) return;
            state.photonWeaveBoostMs = Math.min(
                CONFIG.TUNING.augmentTiming.photonWeaveMaxBoostMs,
                state.photonWeaveStacks * CONFIG.TUNING.augmentTiming.photonWeaveStackBoostMs
            );
            state.photonWeaveStacks = 0;
            state.photonWeaveTimerMs = 0;
            if (this.snake) {
                const pulse = CONFIG.TUNING.fx.pulses.photonWeaveBoost;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitAugmentPulse('photon_weave', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
        }

        startAnimationLoop(): void {
            this.stopAnimationLoop();
            this.lastTime = performance.now();
            if (!this.isRunning || this.manualTimeMode) return;
            this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
        }

        stopAnimationLoop(): void {
            if (this.animationFrameId === null) return;
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        gameLoop(currentTime: number): void {
            this.animationFrameId = null;
            if (!this.isRunning) return;
            if (this.manualTimeMode) return;
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            this.updateFps(deltaTime, currentTime);

            if (!this.isPaused) {
                this.update(deltaTime);
            }

            this.render();
            if (this.isRunning) {
                this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
            }
        }

        advanceTime(ms: number): void {
            this.manualTimeMode = true;
            this.stopAnimationLoop();
            const duration = Number.isFinite(ms) ? Math.max(0, Math.min(ms, 5000)) : 0;
            if (duration > 0 && this.isRunning) {
                const fixedStep = CONFIG.TUNING.time.msPerSecond / 60;
                const steps = Math.max(1, Math.ceil(duration / fixedStep));
                const deltaTime = duration / steps;
                for (let step = 0; step < steps && this.isRunning; step += 1) {
                    if (!this.isPaused) this.update(deltaTime);
                }
            }
            if (this.snake) this.render();
        }

        renderGameToText(): string {
            const isVisible = (id: string): boolean => {
                const element = document.getElementById(id);
                return Boolean(element && !element.hidden && getComputedStyle(element).display !== 'none');
            };
            const phase = isVisible('guide-screen') ? 'guide'
                : isVisible('loading-screen') ? 'loading'
                    : isVisible('augment-screen') ? 'module-selection'
                        : isVisible('pause-menu') ? 'paused'
                            : isVisible('game-over-screen') ? 'game-over'
                                : isVisible('armory-screen') ? 'workshop'
                                    : isVisible('skin-selector-screen') ? 'frame-selection'
                                        : isVisible('start-screen') ? 'start-menu'
                                            : this.isRunning ? 'running'
                                                : 'transition';
            const snake = this.snake;
            const head = snake?.getHead();
            const foodType = this.food.type;
            const powerUpType = this.powerUp?.getType();
            const payload = {
                coordinateSystem: {
                    units: 'grid cells',
                    origin: 'top-left',
                    axes: '+x right, +y down',
                    bounds: { columns: CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE, rows: CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE }
                },
                phase,
                mode: { key: this.modeKey, label: this.mode.label, run: this.runMode },
                run: {
                    running: this.isRunning,
                    paused: this.isPaused,
                    elapsedMs: Math.round(this.elapsedTimeMs),
                    score: this.score,
                    combo: this.comboCount,
                    tokens: this.runShards,
                    heat: Number(this.adrenaline.toFixed(3)),
                    overdriveMs: Math.round(this.overdriveRemainingMs),
                    boostCharges: this.surgeCharges,
                    boostActiveMs: Math.round(this.surgeRemainingMs),
                    boostCooldownMs: Math.round(this.surgeCooldownMs),
                    nextModuleAt: this.nextAugmentAt
                },
                player: snake && head ? {
                    head: { x: head.x, y: head.y },
                    direction: { x: snake.direction.x, y: snake.direction.y },
                    queuedDirection: { x: snake.nextDirection.x, y: snake.nextDirection.y },
                    length: snake.getLength(),
                    body: snake.segments.slice(1).map(segment => ({ x: segment.x, y: segment.y })),
                    ghost: snake.isGhostMode,
                    activePowerUps: snake.getActivePowerUps(this.elapsedTimeMs).map(powerUp => ({
                        type: powerUp.type,
                        remainingMs: Math.round(powerUp.remaining)
                    }))
                } : null,
                collectibles: {
                    food: snake ? { x: this.food.position.x, y: this.food.position.y, type: foodType.name } : null,
                    powerUp: this.powerUp && powerUpType ? {
                        x: this.powerUp.position.x,
                        y: this.powerUp.position.y,
                        type: powerUpType.name
                    } : null,
                    gateRewards: this.gateRewards.map(reward => ({
                        x: reward.position.x,
                        y: reward.position.y,
                        remainingMs: Math.max(0, Math.round(reward.expiresAt - this.elapsedTimeMs))
                    }))
                },
                hazards: this.hazards.map(hazard => ({
                    x: hazard.position.x,
                    y: hazard.position.y,
                    state: hazard.state,
                    timerMs: Math.round(hazard.timer)
                })),
                modules: {
                    active: this.activeAugments.map(augment => augment.id),
                    choices: this.augmentSelectionActive ? this.augmentSelectionChoices.map(augment => augment.id) : []
                }
            };
            return JSON.stringify(payload);
        }

        update(deltaTime: number): void {
            if (!this.snake) return;
            this.elapsedTimeMs += deltaTime;
            this.updateComboDecay();
            this.updateOverdrive(deltaTime);
            this.updateSurge(deltaTime);
            this.updateAugmentEffects(deltaTime);

            this.backdrop.update(deltaTime);
            this.skyline.update(deltaTime);
            this.pulses.update(deltaTime);
            this.updateFlash(deltaTime);

            this.screenShake.update();
            this.grid.update();

            const foodState = this.food.update(this.elapsedTimeMs);
            if (foodState === 'detonate') {
                this.spawnVolatileDetonation();
            }

            if (this.powerUp) {
                this.powerUp.update();
            }

            this.spawnHazardsIfNeeded();
            this.updateHazards(deltaTime);

            if (this.gateRewards.length > 0) {
                const now = this.elapsedTimeMs;
                this.gateRewards = this.gateRewards.filter(reward => now < reward.expiresAt);
            }

            this.snake.updatePowerUps(this.elapsedTimeMs);

            if (this.snake.hasMagnet || this.augmentState.magnetBloomActiveMs > 0 || this.augmentState.prismCoilActiveMs > 0) {
                this.applyMagnetEffect();
            }

            this.particles.update();
            const emitTrail = this.snake.update(deltaTime);
            if (emitTrail) {
                const pos = this.snake.getTrailEmitPosition();
                this.particles.emitTrail(pos.x, pos.y, this.skinManager.getSkinColors().particles);
            }

            const precisionRatio = this.snake.consumePrecision();
            const precisionThreshold = this.activeAugmentFlags.vector_flux
                ? CONFIG.TUNING.precision.vectorFluxThreshold
                : CONFIG.TUNING.precision.threshold;
            if (precisionRatio > precisionThreshold) {
                this.handlePrecisionTurn(precisionRatio);
            }

            const head = this.snake.getHead();
            if (this.snake.checkSelfCollision()) {
                if (!this.tryAegisShield(head, 'self') && !this.tryRevive('self')) {
                    this.gameOver();
                    return;
                }
            }

            if (this.snake.checkWallCollision(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT)) {
                const shielded = this.tryAegisShield(head, 'wall');
                if (!shielded && !this.tryRevive('wall')) {
                    this.gameOver();
                    return;
                }
                this.snake.wrapAround(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            }

            if (this.checkHazardCollision(head)) {
                if (!this.tryAegisShield(head, 'hazard') && !this.tryRevive('hazard')) {
                    this.gameOver();
                    return;
                }
            }

            const foodPos = this.food.getPosition();
            if (head.equals(foodPos)) {
                this.eatFood();
            }

            if (this.powerUp) {
                const powerUpPos = this.powerUp.getPosition();
                if (head.equals(powerUpPos)) {
                    this.collectPowerUp();
                }
            }

            if (this.gateRewards.length > 0) {
                const rewardIndex = this.gateRewards.findIndex(r => r.position.equals(head));
                if (rewardIndex !== -1) {
                    const config = this.mode.gateReward;
                    const scoring = CONFIG.TUNING.scoring;
                    const fx = CONFIG.TUNING.fx;
                    const points = config.points + this.runStats.gateRewardBonus + (this.comboCount * (config.chainBonus + this.runStats.gateChainBonus));
                    this.score += points;
                    this.addShards(this.runStats.gateShardBonus);
                    this.gateRewards.splice(rewardIndex, 1);
                    if (this.activeAugmentFlags.gatecrash_bloom) {
                        const bonusPoints = scoring.gatecrashBloom.bonusBase + Math.floor(this.comboCount * scoring.gatecrashBloom.bonusComboFactor);
                        this.score += bonusPoints;
                        this.addShards(scoring.gatecrashBloom.shardBonus);
                    }
                    this.updateScoreDisplay();
                    this.ui.updateRunShards(this.runShards);
                    this.screenShake.small();
                    this.pulses.emit(
                        head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                        head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                        '#ffba7d',
                        fx.pulses.gateReward.radius,
                        fx.pulses.gateReward.duration,
                        fx.pulses.gateReward.thickness
                    );
                    if (this.activeAugmentFlags.gatecrash_bloom) {
                        const pulse = fx.pulses.gatecrashBloom;
                        this.emitAugmentPulse(
                            'gatecrash_bloom',
                            head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                            head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                            pulse.radius,
                            pulse.duration,
                            pulse.thickness
                        );
                    }
                    if (this.activeAugmentFlags.gate_bounty) {
                        const pulse = fx.pulses.gateBounty;
                        this.emitSignaturePulse(
                            'gate_bounty',
                            head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                            head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2,
                            pulse.radius,
                            pulse.duration,
                            pulse.thickness
                        );
                    }
                    this.soundManager.playGateReward();
                }
            }

            this.checkNearMiss(head);
            this.updateReviveGrace(deltaTime);

            if (this.score >= this.nextAugmentAt) {
                this.openAugmentSelection();
            }
        }

        render(): void {
            const ctx = this.glowRenderer.getContext();
            const legacyColors = window.NeonSnake?.COLORS as {
                snakeHead: string;
                snakeBody: string;
                snakeGlow: string;
                snakeTrail: string;
                snakeParticles: string;
                grid: string;
                gridGlow: string;
                background: string;
            } | undefined;
            const colors = legacyColors || {
                snakeHead: '#2bb3b1',
                snakeBody: '#2bb3b1',
                snakeGlow: '#2bb3b1',
                snakeTrail: '#2bb3b1',
                snakeParticles: '#2bb3b1',
                grid: '#243232',
                gridGlow: '#35504e',
                background: '#0b0d0f'
            };
            this.glowRenderer.clear(colors.background);

            const shake = this.screenShake.getOffset();
            ctx.save();
            ctx.translate(shake.x, shake.y);

            const quality = QUALITY_TIERS[this.qualityTier];
            this.backdrop.draw(ctx, this.qualityTier >= CONFIG.TUNING.quality.lowQualityTierMin, quality.backdropOrbs);
            this.skyline.draw(ctx);
            this.grid.draw(ctx, colors, this.gridScanlines);

            this.food.draw(ctx);
            if (this.powerUp) this.powerUp.draw(ctx);
            if (this.hazards.length > 0) {
                this.hazards.forEach(hazard => hazard.draw(ctx, CONFIG.GRID_SIZE));
            }
            if (this.gateRewards.length > 0) {
                this.gateRewards.forEach(r => {
                    const x = r.position.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    const y = r.position.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    const dot = CONFIG.TUNING.fx.gateRewardDot;
                    ctx.save();
                    ctx.shadowBlur = dot.shadowBlur;
                    ctx.shadowColor = '#ffba7d';
                    ctx.fillStyle = '#ffba7d';
                    ctx.beginPath();
                    ctx.arc(x, y, dot.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            this.particles.draw(ctx);
            this.pulses.draw(ctx);
            if (this.snake) {
                this.snake.draw(ctx);
            }
            this.drawAugmentAuras(ctx);

            ctx.restore();

            this.glowRenderer.render(this.postFx.getContext());
            this.postFx.renderTo(this.ctx, this.elapsedTimeMs, this.qualityTier >= CONFIG.TUNING.quality.lowQualityTierMin);
            this.drawFlash();
            this.drawPowerUpUI();
        }

        drawAugmentAuras(ctx: CanvasRenderingContext2D): void {
            if (!this.snake) return;
            const head = this.snake.getHead();
            const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const state = this.augmentState;
            const auraConfig = CONFIG.TUNING.fx.auras;

            const rings = [];
            if (state.lumenActiveMs > 0) {
                rings.push({ color: this.getAugmentColor('lumen_relay'), ...auraConfig.rings.lumenRelay });
            }
            if (state.prismEchoActiveMs > 0) {
                rings.push({ color: this.getAugmentColor('prism_echo'), ...auraConfig.rings.prismEcho });
            }
            if (state.prismCoilActiveMs > 0) {
                rings.push({ color: this.getAugmentColor('prism_coil'), ...auraConfig.rings.prismCoil });
            }
            if (state.magnetBloomActiveMs > 0) {
                rings.push({ color: this.getAugmentColor('magnet_bloom'), ...auraConfig.rings.magnetBloom });
            }
            if (state.photonWeaveBoostMs > 0) {
                rings.push({ color: this.getAugmentColor('photon_weave'), ...auraConfig.rings.photonWeave });
            }

            if (this.activeAugmentFlags.chromatic_aegis && state.chromaticAegisCharges > 0) {
                rings.push({ color: this.getAugmentColor('chromatic_aegis'), ...auraConfig.rings.chromaticAegis });
            }

            if (rings.length === 0) return;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            rings.forEach((ring, index) => {
                ctx.strokeStyle = ring.color;
                ctx.lineWidth = auraConfig.lineWidth;
                ctx.globalAlpha = ring.alpha;
                ctx.beginPath();
                ctx.arc(x, y, ring.radius + index * auraConfig.ringSpacing, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.restore();
        }

        updateOverdrive(deltaTime: number): void {
            const speedFactor = this.snake
                ? clamp(1 - (this.snake.moveInterval - this.mode.speed.min) / ((this.mode.speed.start || CONFIG.INITIAL_SPEED) - (this.mode.speed.min || CONFIG.MIN_SPEED)), 0, 1)
                : 0;
            const comboFactor = Math.min(this.comboCount / CONFIG.TUNING.overdriveMix.comboScale, 1);
            const hazardFactor = this.hazards.length / Math.max(1, this.mode.hazards.max + this.runStats.hazardMaxBonus);
            const mix = CONFIG.TUNING.overdriveMix;
            const msPerSecond = CONFIG.TUNING.time.msPerSecond;

            if (this.overdriveActive) {
                this.overdriveRemainingMs = Math.max(0, this.overdriveRemainingMs - deltaTime);
                if (this.overdriveRemainingMs <= 0) {
                    this.endOverdrive();
                }
            } else {
                const gain = (speedFactor * mix.gainSpeed + comboFactor * mix.gainCombo + hazardFactor * mix.gainHazard) * (deltaTime / msPerSecond);
                const decay = CONFIG.OVERDRIVE.decayRate * (deltaTime / msPerSecond);
                const boostedGain = gain * (1 + this.runModifiers.overdriveFillBonus);
                this.adrenaline = clamp(this.adrenaline + boostedGain - decay, 0, 1);
                if (this.adrenaline >= 1) {
                    this.triggerOverdrive();
                }
            }

            const overdriveFactor = this.overdriveActive ? 1 : 0;
            if (this.elapsedTimeMs - this.lastMusicUpdate > mix.musicUpdateMs) {
                const intensity = mix.intensityBase + speedFactor * mix.speedWeight + comboFactor * mix.comboWeight + hazardFactor * mix.hazardWeight;
                this.soundManager.updateMusicMix(intensity, {
                    speed: speedFactor,
                    combo: comboFactor,
                    hazards: hazardFactor,
                    overdrive: overdriveFactor
                }, this.activeAugmentFlags, this.augmentState, {
                    combo: this.comboCount,
                    overdriveActive: this.overdriveActive,
                    surgeActive: this.surgeRemainingMs > 0
                });
                this.lastMusicUpdate = this.elapsedTimeMs;
            }

            this.ui.updateAdrenaline(this.overdriveActive ? this.overdriveRemainingMs / this.overdriveDurationMs : this.adrenaline);
            this.ui.updateOverdrive(this.overdriveActive ? `OVERDRIVE ${Math.ceil(this.overdriveRemainingMs / msPerSecond)}s` : 'CHARGE');
            this.updateExternalModifiers();
        }

        triggerOverdrive(): void {
            this.overdriveActive = true;
            this.overdriveRemainingMs = this.overdriveDurationMs;
            this.adrenaline = 0;
            this.postFx.setAberration(CONFIG.TUNING.overdriveFx.aberration);
            this.screenShake.medium();
            this.soundManager.playOverdriveStart();
            this.triggerFlash('#2bb3b1', CONFIG.TUNING.fx.flashes.overdrive);
            if (this.activeAugmentFlags.overdrive_resonator && this.snake) {
                this.augmentState.overdriveBonusBudgetMs = CONFIG.TUNING.augmentTiming.overdriveBonusBudgetMs;
                const pulse = CONFIG.TUNING.fx.pulses.overdriveResonatorStart;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitAugmentPulse('overdrive_resonator', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
            if (this.activeAugmentFlags.overclock && this.snake) {
                const pulse = CONFIG.TUNING.fx.pulses.overclockSignature;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitSignaturePulse('overclock', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
            this.consumePhotonWeaveBoost();
        }

        endOverdrive(): void {
            this.overdriveActive = false;
            this.postFx.setAberration(0);
            this.soundManager.playOverdriveEnd();
            if (this.activeAugmentFlags.overdrive_resonator && this.snake) {
                const warningCount = this.hazards.filter(hazard => hazard.state === 'warning').length;
                const overdriveScoring = CONFIG.TUNING.scoring.overdriveResonator;
                const bonus = Math.max(
                    overdriveScoring.warningShardMin,
                    Math.min(overdriveScoring.warningShardMax, warningCount)
                );
                this.addShards(bonus);
                this.ui.updateRunShards(this.runShards);
                const pulse = CONFIG.TUNING.fx.pulses.overdriveResonatorEnd;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitAugmentPulse('overdrive_resonator', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
        }

        updateSurge(deltaTime: number): void {
            if (this.surgeCooldownMs > 0) {
                this.surgeCooldownMs = Math.max(0, this.surgeCooldownMs - deltaTime);
            }
            if (this.surgeRemainingMs > 0) {
                this.surgeRemainingMs = Math.max(0, this.surgeRemainingMs - deltaTime);
                if (this.surgeRemainingMs <= 0) {
                    this.updateExternalModifiers();
                }
            }
            if (this.surgeLockMs > 0) {
                this.surgeLockMs = Math.max(0, this.surgeLockMs - deltaTime);
            }
            if (this.surgeScoreBoostMs > 0) {
                this.surgeScoreBoostMs = Math.max(0, this.surgeScoreBoostMs - deltaTime);
            }
            this.ui.updateSurgeStatus(`SURGE ${this.surgeCharges} | ${Math.ceil(this.surgeCooldownMs / CONFIG.TUNING.time.msPerSecond)}s`);
        }

        activateSurge(): void {
            if (!this.isRunning || this.isPaused) return;
            if (this.surgeCharges <= 0 || this.surgeCooldownMs > 0 || this.surgeRemainingMs > 0) return;
            this.surgeCharges -= 1;
            this.surgeRemainingMs = CONFIG.SURGE.durationMs;
            this.surgeCooldownMs = CONFIG.SURGE.cooldownMs * this.runStats.surgeCooldownScale;
            this.surgeLockMs = CONFIG.SURGE.lockMs;
            if (this.runStats.surgeScoreBoost > 0) {
                this.surgeScoreBoostMs = CONFIG.SURGE.scoreBoostMs;
            }
            this.updateExternalModifiers();
            this.soundManager.playSurge();
            this.triggerFlash('#f08a4b', CONFIG.TUNING.fx.flashes.surge);
            if (this.activeAugmentFlags.kaleidosurge_wake && this.snake) {
                this.augmentState.kaleidoSurgeBudgetMs = CONFIG.TUNING.augmentTiming.kaleidoSurgeBudgetMs;
                const pulse = CONFIG.TUNING.fx.pulses.kaleidosurgeWake;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitAugmentPulse('kaleidosurge_wake', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
            if (this.activeAugmentFlags.surge_vector && this.snake) {
                const pulse = CONFIG.TUNING.fx.pulses.surgeVector;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitSignaturePulse('surge_vector', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
            this.consumePhotonWeaveBoost();
        }

        updateExternalModifiers(): void {
            if (!this.snake) return;
            let speed = 1;
            let score = this.runStats.scoreMultiplier;
            let ghost = this.reviveGraceMs > 0;

            if (this.overdriveActive) {
                speed *= CONFIG.OVERDRIVE.speedMultiplier;
                score *= CONFIG.OVERDRIVE.scoreMultiplier * this.runModifiers.overdriveScoreMultiplier;
            }
            if (this.surgeRemainingMs > 0) {
                speed *= CONFIG.SURGE.speedMultiplier;
                if (this.surgeScoreBoostMs > 0) score *= 1 + this.runStats.surgeScoreBoost;
            }
            this.snake.setExternalModifiers({ speed, score, ghost });
        }

        updateReviveGrace(deltaTime: number): void {
            if (this.reviveGraceMs > 0) {
                this.reviveGraceMs = Math.max(0, this.reviveGraceMs - deltaTime);
                if (this.reviveGraceMs === 0) {
                    this.updateExternalModifiers();
                }
            }
        }

        updateSpeedCurve(): void {
            if (!this.snake) return;
            const { start, min, rampScore, curve } = this.mode.speed;
            const t = Math.max(0, Math.min(1, this.score / rampScore));
            const eased = curve === 'easeOutCubic' ? easeOutCubic(t) : t;
            this.snake.baseSpeed = Math.max(min, start - (start - min) * eased);
            this.snake.updatePowerUpProperties();
        }

        spawnVolatileDetonation(): void {
            const pos = this.food.getPosition();
            if (this.mode.volatile.enabled) {
                this.hazards.push(new Hazard(pos, 0, this.mode.volatile.detonateHazardMs));
            }
            this.comboCount = 0;
            this.triggerFlash('#c73a2f', CONFIG.TUNING.fx.flashes.volatile);
            this.soundManager.playDie();
            if (this.activeAugmentFlags.volatile_alchemy) {
                const pulse = CONFIG.TUNING.fx.pulses.volatileAlchemy;
                const x = pos.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = pos.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitSignaturePulse('volatile_alchemy', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
            this.food.respawn(this.elapsedTimeMs);
            this.ensureCollectibleNotOnSnake();
        }

        applyMagnetEffect(): void {
            if (!this.snake) return;
            const head = this.snake.getHead();
            const headX = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const headY = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const magnetTuning = CONFIG.TUNING.magnet;

            const bonusRange = (this.augmentState.magnetBloomActiveMs > 0 ? magnetTuning.bloomBonusRange : 0)
                + (this.augmentState.prismCoilActiveMs > 0 ? magnetTuning.coilBonusRange : 0);
            const effectiveRange = this.snake.magnetRange + bonusRange * CONFIG.GRID_SIZE;
            const pullStrength = Math.max(
                this.augmentState.magnetBloomActiveMs > 0 ? magnetTuning.bloomPullStrength : magnetTuning.basePullStrength,
                this.augmentState.prismCoilActiveMs > 0 ? magnetTuning.coilPullStrength : magnetTuning.basePullStrength
            );

            const targets = [{ type: 'food', pos: this.food.getPosition() }];
            const allowPowerup = this.runStats.magnetPowerup || this.augmentState.magnetBloomActiveMs > 0 || this.augmentState.prismCoilActiveMs > 0;
            if (allowPowerup && this.powerUp) {
                targets.push({ type: 'powerup', pos: this.powerUp.getPosition() });
            }

            targets.forEach(target => {
                const tx = target.pos.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const ty = target.pos.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const dx = tx - headX;
                const dy = ty - headY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= effectiveRange && distance > CONFIG.GRID_SIZE * magnetTuning.minDistanceTiles) {
                    const newX = target.pos.x - (dx / CONFIG.GRID_SIZE) * pullStrength;
                    const newY = target.pos.y - (dy / CONFIG.GRID_SIZE) * pullStrength;
                    const maxX = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
                    const maxY = Math.floor(CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE);
                    const nextX = Math.max(0, Math.min(maxX - 1, Math.round(newX)));
                    const nextY = Math.max(0, Math.min(maxY - 1, Math.round(newY)));
                    const nextPos = new Vector2D(nextX, nextY);
                    if (!this.hazards.some(hazard => hazard.position.equals(nextPos))) {
                        if (target.type === 'food') {
                            this.food.position.x = nextX;
                            this.food.position.y = nextY;
                        } else if (this.powerUp) {
                            this.powerUp.position.x = nextX;
                            this.powerUp.position.y = nextY;
                        }
                    }
                }
            });
        }

        eatFood(): void {
            if (!this.snake) return;
            this.snake.grow();
            this.updateSpeedCurve();
            this.updateComboOnEat();

            const state = this.augmentState;
            const scoring = CONFIG.TUNING.scoring;
            const fx = CONFIG.TUNING.fx;
            let basePoints = this.food.getPoints();
            if (this.food.type.name === 'volatile') {
                basePoints += this.runStats.volatileBonus;
            }
            const comboMultiplier = this.getComboMultiplier();
            let augmentMultiplier = 1;
            let augmentShardBonus = 0;

            if (state.prismEchoActiveMs > 0) {
                augmentMultiplier += scoring.augmentFood.prismEchoMultiplier;
                augmentShardBonus += scoring.augmentFood.prismEchoShardBonus;
            }
            if (state.prismCoilActiveMs > 0) {
                augmentMultiplier += scoring.augmentFood.prismCoilMultiplier;
                augmentShardBonus += scoring.augmentFood.prismCoilShardBonus;
            }
            if (state.lumenActiveMs > 0) {
                augmentShardBonus += scoring.augmentFood.lumenShardBonus;
                this.adrenaline = clamp(this.adrenaline + scoring.augmentFood.lumenAdrenalineGain, 0, 1);
            }
            if (state.photonWeaveBoostMs > 0) {
                augmentMultiplier += scoring.augmentFood.photonWeaveMultiplier;
            }
            if (this.surgeRemainingMs > 0 && this.activeAugmentFlags.kaleidosurge_wake) {
                augmentMultiplier += scoring.augmentFood.kaleidosurgeMultiplier;
                if (state.kaleidoSurgeBudgetMs > 0) {
                    const extend = Math.min(CONFIG.TUNING.augmentTiming.kaleidoSurgeExtendMs, state.kaleidoSurgeBudgetMs);
                    state.kaleidoSurgeBudgetMs -= extend;
                    this.surgeRemainingMs += extend;
                }
            }
            if (this.overdriveActive && this.activeAugmentFlags.overdrive_resonator && state.overdriveBonusBudgetMs > 0) {
                const extend = Math.min(CONFIG.TUNING.augmentTiming.overdriveBonusExtendMs, state.overdriveBonusBudgetMs);
                state.overdriveBonusBudgetMs -= extend;
                const maxOverdrive = this.overdriveDurationMs + CONFIG.TUNING.augmentTiming.overdriveBonusMaxMs;
                this.overdriveRemainingMs = Math.min(maxOverdrive, this.overdriveRemainingMs + extend);
            }

            const points = Math.floor(basePoints * this.snake.scoreMultiplier * comboMultiplier * augmentMultiplier);
            this.score += points;
            this.foodEaten++;
            const shardBase = this.food.type.name === 'basic'
                ? scoring.foodShardBase.basic
                : this.food.type.name === 'bonus'
                    ? scoring.foodShardBase.bonus
                    : this.food.type.name === 'super'
                        ? scoring.foodShardBase.super
                        : scoring.foodShardBase.volatile;
            const shardGain = shardBase + (this.food.type.name === 'volatile' ? this.runStats.volatileShardBonus : 0) + augmentShardBonus;
            this.addShards(shardGain);

            this.skinManager.unlockSkins(this.score);
            this.updateScoreDisplay();
            this.ui.updateRunShards(this.runShards);

            if (this.activeAugmentFlags.gatecrash_bloom && !this.mode.gateReward?.enabled) {
                state.gatecrashBloomCount += 1;
                if (state.gatecrashBloomCount >= CONFIG.TUNING.augmentTiming.gatecrashBloomCount) {
                    state.gatecrashBloomCount = 0;
                    const bonusPoints = scoring.gatecrashBloom.bonusBase + Math.floor(this.comboCount * scoring.gatecrashBloom.bonusComboFactor);
                    this.score += bonusPoints;
                    this.addShards(scoring.gatecrashBloom.shardBonus);
                    this.updateScoreDisplay();
                    this.ui.updateRunShards(this.runShards);
                    const pulse = fx.pulses.gatecrashBloom;
                    const head = this.snake.getHead();
                    const ex = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    const ey = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    this.emitAugmentPulse('gatecrash_bloom', ex, ey, pulse.radius, pulse.duration, pulse.thickness);
                }
            }

            if (this.activeAugmentFlags.prism_echo) {
                state.prismEchoCount += 1;
                if (state.prismEchoCount >= CONFIG.TUNING.augmentTiming.prismEchoCount) {
                    state.prismEchoCount = 0;
                    state.prismEchoActiveMs = CONFIG.TUNING.augmentTiming.prismEchoActiveMs;
                    const pulse = fx.pulses.prismEcho;
                    const head = this.snake.getHead();
                    const ex = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    const ey = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    this.emitAugmentPulse('prism_echo', ex, ey, pulse.radius, pulse.duration, pulse.thickness);
                }
            }

            if (this.activeAugmentFlags.prism_coil) {
                state.prismCoilCount += 1;
                if (state.prismCoilCount >= CONFIG.TUNING.augmentTiming.prismCoilCount) {
                    state.prismCoilCount = 0;
                    state.prismCoilActiveMs = CONFIG.TUNING.augmentTiming.prismCoilActiveMs;
                    const pulse = fx.pulses.prismCoil;
                    const head = this.snake.getHead();
                    const ex = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    const ey = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                    this.emitAugmentPulse('prism_coil', ex, ey, pulse.radius, pulse.duration, pulse.thickness);
                }
            }

            if (this.activeAugmentFlags.magnet_bloom && this.comboCount >= state.magnetBloomNextCombo) {
                state.magnetBloomActiveMs = CONFIG.TUNING.augmentTiming.magnetBloomActiveMs;
                state.magnetBloomNextCombo += CONFIG.TUNING.augmentTiming.magnetBloomComboStep;
                const pulse = fx.pulses.magnetBloom;
                const head = this.snake.getHead();
                const ex = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const ey = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitAugmentPulse('magnet_bloom', ex, ey, pulse.radius, pulse.duration, pulse.thickness);
            }

            if (this.activeAugmentFlags.prism_echo && state.prismEchoActiveMs > 0) {
                const head = this.snake.getHead();
                const ex = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const ey = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.particles.emit(ex, ey, this.getParticleCount(fx.particles.augmentTrailPrismEcho), this.getAugmentColor('prism_echo'), 'trail');
            }

            if (this.activeAugmentFlags.kaleidosurge_wake && this.surgeRemainingMs > 0) {
                const head = this.snake.getHead();
                const ex = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const ey = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.particles.emit(ex, ey, this.getParticleCount(fx.particles.augmentTrailKaleidosurge), this.getAugmentColor('kaleidosurge_wake'), 'trail');
            }

            if (this.food.type.name === 'basic') {
                this.screenShake.small();
            } else {
                this.screenShake.medium();
            }

            const foodPos = this.food.getPosition();
            const x = foodPos.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const y = foodPos.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const particleColor = this.food.getParticleColor();

            if (this.food.type.name === 'super') {
                this.particles.emit(x, y, this.getParticleCount(fx.particles.foodSuper), particleColor, 'explosion');
            } else {
                this.particles.emit(x, y, this.getParticleCount(fx.particles.foodStandard), particleColor, 'spark');
            }

            if (this.food.type.name === 'basic') {
                const pulse = fx.pulses.foodBasic;
                this.pulses.emit(x, y, particleColor, pulse.radius, pulse.duration, pulse.thickness);
                this.triggerFlash(this.food.type.color, fx.flashes.foodBasic);
            } else if (this.food.type.name === 'bonus') {
                const pulse = fx.pulses.foodBonus;
                this.pulses.emit(x, y, particleColor, pulse.radius, pulse.duration, pulse.thickness);
                this.triggerFlash(this.food.type.color, fx.flashes.foodBonus);
            } else {
                const pulse = fx.pulses.foodSuper;
                this.pulses.emit(x, y, particleColor, pulse.radius, pulse.duration, pulse.thickness);
                this.triggerFlash(this.food.type.color, fx.flashes.foodSuper);
            }

            if (this.food.type.name === 'basic') this.soundManager.playEat();
            else if (this.food.type.name === 'bonus') this.soundManager.playBonus();
            else if (this.food.type.name === 'super') this.soundManager.playSuper();

            this.spawnNextCollectible();
            this.ensureCollectibleNotOnSnake();
        }

        spawnNextCollectible(): void {
            if (!this.powerUp && Math.random() < this.powerupChance) {
                this.powerUp = new PowerUp(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, CONFIG.GRID_SIZE);
            } else {
                this.food.respawn(this.elapsedTimeMs);
            }
        }

        ensureCollectibleNotOnSnake(): void {
            if (!this.snake) return;
            const snakeSegments = this.snake.getSegments();
            let attempts = 0;
            while (attempts < CONFIG.TUNING.collectibles.foodAttempts) {
                const foodPos = this.food.getPosition();
                let onSnake = false;
                for (const segment of snakeSegments) {
                    if (segment.equals(foodPos)) {
                        onSnake = true;
                        break;
                    }
                }
                const onHazard = this.hazards.some(hazard => hazard.position.equals(foodPos));
                if (!onSnake && !onHazard && (!this.powerUp || !foodPos.equals(this.powerUp.getPosition()))) break;
                this.food.respawn(this.elapsedTimeMs);
                attempts++;
            }

            if (this.powerUp) {
                attempts = 0;
                while (attempts < CONFIG.TUNING.collectibles.powerUpAttempts) {
                    const powerUpPos = this.powerUp.getPosition();
                    let onSnake = false;
                    for (const segment of snakeSegments) {
                        if (segment.equals(powerUpPos)) {
                            onSnake = true;
                            break;
                        }
                    }
                    const onHazard = this.hazards.some(hazard => hazard.position.equals(powerUpPos));
                    if (!onSnake && !onHazard && !powerUpPos.equals(this.food.getPosition())) break;
                    this.powerUp.respawn();
                    attempts++;
                }
            }
        }

        spawnHazardsIfNeeded(): void {
            const hConfig = this.mode.hazards;
            const targetCount = Math.min(
                hConfig.max + this.runStats.hazardMaxBonus + (this.overdriveActive ? CONFIG.TUNING.hazards.overdriveBonus : 0),
                Math.floor(this.score / hConfig.spawnStep)
            );
            while (this.hazards.length < targetCount) {
                const position = this.getSafeRandomPosition();
                if (!position) break;
                this.hazards.push(new Hazard(position, hConfig.warningMs, hConfig.activeMs));
            }
        }

        updateHazards(deltaTime: number): void {
            if (this.hazards.length === 0) return;
            this.hazards.forEach((hazard) => {
                const prevState = hazard.state;
                hazard.update(deltaTime);
                if (prevState === 'active' && hazard.state === 'warning' && this.mode.gateReward?.enabled) {
                    this.gateRewards.push({
                        position: hazard.position.copy(),
                        expiresAt: this.elapsedTimeMs + this.mode.gateReward.ttlMs
                    });
                }
                if (hazard.state === 'warning' && hazard.timer === 0) {
                    const position = this.getSafeRandomPosition(hazard.position);
                    if (position) hazard.position = position;
                }
            });
        }

        checkHazardCollision(head: Vector2D): boolean {
            if (this.snake && this.snake.isGhostMode) return false;
            for (const hazard of this.hazards) {
                if (hazard.isActive() && head.equals(hazard.position)) {
                    return true;
                }
            }
            return false;
        }

        getSafeRandomPosition(currentPosition?: Vector2D): Vector2D | null {
            const maxX = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
            const maxY = Math.floor(CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE);
            const snakeSegments = this.snake ? this.snake.getSegments() : [];
            let attempts = 0;
            while (attempts < CONFIG.TUNING.collectibles.hazardAttempts) {
                const position = new Vector2D(
                    Math.floor(Math.random() * maxX),
                    Math.floor(Math.random() * maxY)
                );

                if (currentPosition && position.equals(currentPosition)) {
                    attempts++;
                    continue;
                }

                let blocked = false;
                for (const segment of snakeSegments) {
                    if (segment.equals(position)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) {
                    attempts++;
                    continue;
                }
                if (this.food && position.equals(this.food.getPosition())) {
                    attempts++;
                    continue;
                }
                if (this.powerUp && position.equals(this.powerUp.getPosition())) {
                    attempts++;
                    continue;
                }
                if (this.hazards.some(hazard => hazard.position.equals(position))) {
                    attempts++;
                    continue;
                }
                return position;
            }
            return null;
        }

        collectPowerUp(): void {
            if (!this.powerUp || !this.snake) return;
            const powerUpType = this.powerUp.getType();
            this.snake.addPowerUp(powerUpType, this.elapsedTimeMs);

            const powerUpPos = this.powerUp.getPosition();
            const x = powerUpPos.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const y = powerUpPos.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const fx = CONFIG.TUNING.fx;
            const powerPulse = fx.pulses.powerUp;
            this.particles.emit(x, y, this.getParticleCount(fx.particles.powerUpExplosion), powerUpType.color, 'explosion');
            this.particles.emit(x, y, this.getParticleCount(fx.particles.powerUpSpark), powerUpType.glow, 'spark');
            this.pulses.emit(x, y, powerUpType.color, powerPulse.radius, powerPulse.duration, powerPulse.thickness);
            this.triggerFlash(powerUpType.color, fx.flashes.powerUp);
            this.screenShake.big();
            this.soundManager.playPowerUp(powerUpType.name);

            if (this.activeAugmentFlags.magnetic_bloom && powerUpType.name === 'MAG') {
                const pulse = fx.pulses.magneticBloomSignature;
                this.emitSignaturePulse('magnetic_bloom', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }

            if (this.runStats.powerupShardBonus) {
                this.addShards(this.runStats.powerupShardBonus);
                this.ui.updateRunShards(this.runShards);
            }
            if (this.runStats.powerupExtendOverdrive) {
                this.overdriveRemainingMs = Math.min(this.overdriveDurationMs, this.overdriveRemainingMs + this.runStats.powerupExtendOverdrive);
            }

            if (this.activeAugmentFlags.prism_coil) {
                this.augmentState.prismCoilCount += 1;
                if (this.augmentState.prismCoilCount >= CONFIG.TUNING.augmentTiming.prismCoilCount) {
                    this.augmentState.prismCoilCount = 0;
                    this.augmentState.prismCoilActiveMs = CONFIG.TUNING.augmentTiming.prismCoilActiveMs;
                    const pulse = fx.pulses.prismCoil;
                    this.emitAugmentPulse('prism_coil', x, y, pulse.radius, pulse.duration, pulse.thickness);
                }
            }

            if (this.activeAugmentFlags.pulse_harvest) {
                const pulse = fx.pulses.pulseHarvestSignature;
                this.emitSignaturePulse('pulse_harvest', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }

            this.powerUp = null;
        }

        handlePrecisionTurn(ratio: number): void {
            if (!this.snake) return;
            const bonus = Math.floor(CONFIG.TUNING.precision.bonusBase + ratio * CONFIG.TUNING.precision.bonusScale);
            this.score += bonus;
            this.addShards(CONFIG.TUNING.precision.shardBonus);
            this.updateScoreDisplay();
            this.ui.updateRunShards(this.runShards);
            const head = this.snake.getHead();
            const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const fx = CONFIG.TUNING.fx;
            const precisionPulse = fx.pulses.precision;
            this.pulses.emit(x, y, '#2bb3b1', precisionPulse.radius, precisionPulse.duration, precisionPulse.thickness);
            if (this.activeAugmentFlags.vector_flux) {
                this.adrenaline = clamp(this.adrenaline + CONFIG.TUNING.precision.adrenalineGain, 0, 1);
                if (this.surgeCooldownMs > 0) {
                    this.surgeCooldownMs = Math.max(0, this.surgeCooldownMs - CONFIG.TUNING.precision.surgeCooldownCutMs);
                }
                const pulse = fx.pulses.vectorFlux;
                this.emitAugmentPulse('vector_flux', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
            if (this.activeAugmentFlags.combo_weave) {
                const pulse = fx.pulses.comboWeaveSignature;
                this.emitSignaturePulse('combo_weave', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
        }

        checkNearMiss(head: Vector2D): void {
            if (this.elapsedTimeMs - this.lastNearMissAt < CONFIG.NEAR_MISS.cooldownMs) return;
            const maxX = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
            const maxY = Math.floor(CONFIG.CANVAS_HEIGHT / CONFIG.GRID_SIZE);
            const { wallBuffer, hazardDistance, adrenalineGain } = CONFIG.TUNING.nearMiss;
            let near = head.x <= wallBuffer
                || head.x >= maxX - (wallBuffer + 1)
                || head.y <= wallBuffer
                || head.y >= maxY - (wallBuffer + 1);
            if (!near) {
                for (const hazard of this.hazards) {
                    if (!hazard.isActive()) continue;
                    const dx = Math.abs(hazard.position.x - head.x);
                    const dy = Math.abs(hazard.position.y - head.y);
                    if (dx + dy <= hazardDistance) {
                        near = true;
                        break;
                    }
                }
            }
            if (near) {
                const points = CONFIG.NEAR_MISS.points + this.runStats.nearMissBonus;
                this.score += points;
                this.addShards(CONFIG.NEAR_MISS.shard + this.runStats.nearMissShardBonus);
                this.updateScoreDisplay();
                this.ui.updateRunShards(this.runShards);
                this.adrenaline = clamp(this.adrenaline + adrenalineGain, 0, 1);
                this.soundManager.playNearMiss();
                this.lastNearMissAt = this.elapsedTimeMs;
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                if (this.activeAugmentFlags.lumen_relay) {
                    this.augmentState.lumenActiveMs = CONFIG.TUNING.augmentTiming.lumenActiveMs;
                    this.augmentState.lumenTickMs = 0;
                    const pulse = CONFIG.TUNING.fx.pulses.lumenRelay;
                    this.emitAugmentPulse('lumen_relay', x, y, pulse.radius, pulse.duration, pulse.thickness);
                }
                if (this.activeAugmentFlags.ion_prism) {
                    const pulse = CONFIG.TUNING.fx.pulses.ionPrismSignature;
                    this.emitSignaturePulse('ion_prism', x, y, pulse.radius, pulse.duration, pulse.thickness);
                }
                if (this.activeAugmentFlags.hazard_forge) {
                    const pulse = CONFIG.TUNING.fx.pulses.hazardForgeSignature;
                    this.emitSignaturePulse('hazard_forge', x, y, pulse.radius, pulse.duration, pulse.thickness);
                }
            }
        }

        tryRevive(reason: string): boolean {
            if (this.reviveCharges <= 0) return false;
            this.reviveCharges -= 1;
            this.reviveGraceMs = CONFIG.TUNING.revive.graceMs + (this.runModifiers.reviveGhostBonusMs || 0);
            this.updateExternalModifiers();
            this.screenShake.medium();
            this.triggerFlash('#2bb3b1', CONFIG.TUNING.fx.flashes.revive);
            this.soundManager.playOverdriveStart();
            if (this.activeAugmentFlags.ghost_mesh && this.snake) {
                const pulse = CONFIG.TUNING.fx.pulses.ghostMeshSignature;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitSignaturePulse('ghost_mesh', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
            return true;
        }

        gameOver(): void {
            this.isRunning = false;
            this.setTouchControlsVisible(false);
            this.input?.setEnabled(false);
            this.soundManager.playDie();
            this.soundManager.updateMusicMix(CONFIG.TUNING.audio.gameOverMixIntensity, { speed: 0, combo: 0, hazards: 0, overdrive: 0 }, this.activeAugmentFlags, this.augmentState, {
                combo: this.comboCount,
                overdriveActive: false,
                surgeActive: false
            });
            this.screenShake.big();

            if (!this.snake) return;
            const head = this.snake.getHead();
            const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
            const skinColors = this.skinManager.getSkinColors();
            const fx = CONFIG.TUNING.fx;
            const pulse = fx.pulses.gameOver;
            this.particles.emit(x, y, this.getParticleCount(fx.particles.gameOverExplosion), skinColors.head, 'explosion');
            this.pulses.emit(x, y, '#c73a2f', pulse.radius, pulse.duration, pulse.thickness);
            this.triggerFlash('#c73a2f', fx.flashes.gameOver);

            if (this.score > this.highScore) {
                this.highScore = this.score;
                this.metaStore.data.highScore = this.highScore;
                this.metaStore.save();
                this.updateHighScoreDisplay();
            }

            const shardsEarned = Math.max(
                0,
                Math.floor(
                    this.score * CONFIG.TUNING.runRewards.shardScoreFactor
                    + this.maxCombo * CONFIG.TUNING.runRewards.shardComboFactor
                    + this.augmentStage * CONFIG.TUNING.runRewards.shardAugmentStageFactor
                )
            );
            this.metaStore.addShards(shardsEarned);
            this.metaStore.addXp(shardsEarned);
            this.refreshMetaUI();

            this.saveRunMeta(shardsEarned);
            this.ui.updateGameOverStats({
                score: this.score,
                length: this.snake.getLength(),
                food: this.foodEaten,
                time: formatTime(this.elapsedTimeMs),
                combo: this.maxCombo,
                shards: shardsEarned
            });

            setTimeout(() => {
                this.ui.showScreen(this.ui.el.gameOverScreen);
                this.ui.announce(`Drift complete. Final score ${this.score}.`);
                document.getElementById('restart-btn')?.focus();
            }, CONFIG.TUNING.gameOver.screenDelayMs);
        }

        saveRunMeta(shardsEarned: number): void {
            const daily = this.metaStore.data.daily;
            const runId = this.runId || this.generateRunId();
            this.runId = runId;
            const entry: LeaderboardEntry = {
                id: runId,
                tag: this.metaStore.data.playerTag || 'ANON',
                score: this.score,
                timeMs: Math.round(this.elapsedTimeMs),
                time: formatTime(this.elapsedTimeMs),
                date: getLocalDateKey(),
                mode: this.runMode
            };

            this.metaStore.data.leaderboard.allTime = this.metaStore.addLeaderboardEntry(
                this.metaStore.data.leaderboard.allTime,
                entry,
                CONFIG.LEADERBOARD_LIMIT
            );

            if (this.runMode === 'daily') {
                this.metaStore.data.leaderboard.daily.entries = this.metaStore.addLeaderboardEntry(
                    this.metaStore.data.leaderboard.daily.entries,
                    entry,
                    CONFIG.LEADERBOARD_LIMIT
                );
                if (this.score > daily.bestScore) {
                    daily.bestScore = this.score;
                }
                if (this.score >= daily.targetScore && !daily.completedAt) {
                    daily.completedAt = Date.now();
                }
            }

            const replay: ReplayData = {
                id: runId,
                createdAt: Date.now(),
                mode: this.runMode,
                score: this.score,
                durationMs: Math.round(this.elapsedTimeMs),
                maxCombo: this.maxCombo,
                foodEaten: this.foodEaten,
                length: this.snake ? this.snake.getLength() : 0,
                augments: this.activeAugments.map(a => a.id),
                shards: shardsEarned
            };
            const shareCode = this.metaStore.createShareCode(replay);
            replay.shareCode = shareCode;
            this.metaStore.data.replays.unshift(replay);
            this.metaStore.data.replays = this.metaStore.data.replays.slice(0, CONFIG.REPLAY_LIMIT);
            this.metaStore.data.lastShareCode = shareCode;
            this.metaStore.save();
        }

        setAugmentSelectionIndex(index: number): void {
            const count = this.augmentSelectionChoices.length;
            if (count === 0) return;
            const nextIndex = (index + count) % count;
            this.augmentSelectionIndex = nextIndex;
            this.ui.setAugmentSelection(nextIndex);
        }

        handleAugmentSelectionKeyDown(event: KeyboardEvent): void {
            if (!this.augmentSelectionActive) return;
            const { key, code } = event;
            const count = this.augmentSelectionChoices.length;
            if (count === 0) return;

            const lower = key.toLowerCase();
            if (key === 'ArrowLeft' || key === 'ArrowUp' || lower === 'a' || lower === 'w') {
                event.preventDefault();
                this.setAugmentSelectionIndex(this.augmentSelectionIndex - 1);
                return;
            }
            if (key === 'ArrowRight' || key === 'ArrowDown' || lower === 'd' || lower === 's') {
                event.preventDefault();
                this.setAugmentSelectionIndex(this.augmentSelectionIndex + 1);
                return;
            }

            const numberMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '!': 0, '@': 1, '#': 2 };
            let index = numberMap[key];
            if (typeof index !== 'number' && code.startsWith('Numpad')) {
                const digit = parseInt(code.replace('Numpad', ''), 10);
                if (!Number.isNaN(digit)) index = digit - 1;
            }

            if (typeof index === 'number') {
                event.preventDefault();
                if (index >= 0 && index < count) {
                    this.pickAugment(this.augmentSelectionChoices[index]);
                }
                return;
            }

            if (key === ' ' || key === 'Enter') {
                event.preventDefault();
                this.pickAugment(this.augmentSelectionChoices[this.augmentSelectionIndex]);
            }
        }

        pickAugment(choice: Augment): void {
            this.applyAugment(choice);
            this.activeAugments.push(choice);
            this.ui.updateAugments(this.activeAugments);
            this.isPaused = false;
            this.augmentSelectionActive = false;
            this.augmentSelectionChoices = [];
            this.ui.setAugmentSelection(-1);
            this.soundManager.setPauseDucking(false);
            if (this.input) {
                this.input.setEnabled(true);
                this.input.setPaused(false);
            }
            this.lastTime = performance.now();
            const augmentScreen = document.getElementById('augment-screen');
            if (augmentScreen) augmentScreen.style.display = 'none';
        }

        openAugmentSelection(): void {
            if (this.isPaused || this.augmentSelectionActive) return;
            this.isPaused = true;
            this.augmentSelectionActive = true;
            this.soundManager.setPauseDucking(true);
            this.augmentStage += 1;
            this.nextAugmentAt += CONFIG.AUGMENT_STEP_INC + this.augmentStage * CONFIG.TUNING.augmentSelection.stageBonus;
            if (this.availableAugments.length < CONFIG.TUNING.augmentSelection.choices) {
                const remaining = AUGMENTS.filter(a => !this.activeAugments.find(active => active.id === a.id));
                this.availableAugments = shuffle(remaining.length ? remaining : AUGMENTS);
            }
            const choices = this.availableAugments.splice(0, CONFIG.TUNING.augmentSelection.choices);
            this.augmentSelectionChoices = choices;
            this.ui.renderAugmentChoices(choices, (choice) => this.pickAugment(choice), this.augmentStage);
            this.setAugmentSelectionIndex(0);
            if (this.input) {
                this.input.setEnabled(false);
                this.input.setPaused(true);
            }
            const augmentScreen = document.getElementById('augment-screen');
            if (augmentScreen) augmentScreen.style.display = 'flex';
        }

        applyAugment(augment: Augment): void {
            const effects = CONFIG.TUNING.augmentEffects;
            this.activeAugmentFlags[augment.id] = true;
            if (augment.id === 'spectrum_signatures') {
                const state = this.augmentState;
                state.signatureEnabled = true;
                const bonus = Math.min(
                    effects.spectrum_signatures.maxScoreBonus,
                    this.activeAugments.length * effects.spectrum_signatures.bonusPerAugment
                );
                const delta = bonus - state.signatureScoreBonus;
                if (delta > 0) {
                    this.runModifiers.scoreMultiplier += delta;
                    state.signatureScoreBonus = bonus;
                }
            } else if (this.augmentState.signatureEnabled && this.augmentState.signatureScoreBonus < effects.spectrum_signatures.maxScoreBonus) {
                const delta = Math.min(
                    effects.spectrum_signatures.bonusStep,
                    effects.spectrum_signatures.maxScoreBonus - this.augmentState.signatureScoreBonus
                );
                this.runModifiers.scoreMultiplier += delta;
                this.augmentState.signatureScoreBonus += delta;
            }

            switch (augment.id) {
                case 'overclock':
                    this.runModifiers.overdriveFillBonus += effects.overclock.overdriveFillBonus;
                    this.runModifiers.overdriveDurationBonus += effects.overclock.overdriveDurationBonusMs;
                    break;
                case 'ion_prism':
                    this.runModifiers.scoreMultiplier += effects.ion_prism.scoreMultiplier;
                    this.runModifiers.nearMissBonus += effects.ion_prism.nearMissBonus;
                    break;
                case 'combo_weave':
                    this.runModifiers.comboWindowBonus += effects.combo_weave.comboWindowBonusMs;
                    this.runModifiers.comboMaxBonusBonus += effects.combo_weave.comboMaxBonusBonus;
                    break;
                case 'magnetic_bloom':
                    this.runModifiers.magnetRangeBonus += effects.magnetic_bloom.magnetRangeBonus;
                    this.runModifiers.magnetPowerup = true;
                    break;
                case 'gate_bounty':
                    this.runModifiers.gateRewardBonus += effects.gate_bounty.gateRewardBonus;
                    this.runModifiers.gateChainBonus += effects.gate_bounty.gateChainBonus;
                    this.runModifiers.gateShardBonus += effects.gate_bounty.gateShardBonus;
                    break;
                case 'surge_vector':
                    this.runModifiers.surgeCooldownScale = Math.max(
                        effects.surge_vector.cooldownScaleMin,
                        this.runModifiers.surgeCooldownScale * effects.surge_vector.cooldownScaleMultiplier
                    );
                    this.runModifiers.surgeScoreBoost += effects.surge_vector.scoreBoost;
                    break;
                case 'ghost_mesh':
                    this.runModifiers.reviveChargesBonus += effects.ghost_mesh.reviveChargesBonus;
                    this.runModifiers.reviveGhostBonusMs += effects.ghost_mesh.reviveGhostBonusMs;
                    this.reviveCharges += effects.ghost_mesh.reviveChargesBonus;
                    break;
                case 'volatile_alchemy':
                    this.runModifiers.volatileBonus += effects.volatile_alchemy.volatileBonus;
                    this.runModifiers.volatileShardBonus += effects.volatile_alchemy.volatileShardBonus;
                    break;
                case 'pulse_harvest':
                    this.runModifiers.powerupShardBonus += effects.pulse_harvest.powerupShardBonus;
                    this.runModifiers.powerupExtendOverdrive += effects.pulse_harvest.powerupExtendOverdriveMs;
                    break;
                case 'hazard_forge':
                    this.runModifiers.hazardMaxBonus += effects.hazard_forge.hazardMaxBonus;
                    this.runModifiers.nearMissShardBonus += effects.hazard_forge.nearMissShardBonus;
                    break;
                case 'lumen_relay':
                    this.augmentState.lumenActiveMs = 0;
                    break;
                case 'prism_echo':
                    this.augmentState.prismEchoCount = 0;
                    break;
                case 'kaleidosurge_wake':
                    this.augmentState.kaleidoSurgeBudgetMs = 0;
                    break;
                case 'overdrive_resonator':
                    this.augmentState.overdriveBonusBudgetMs = 0;
                    break;
                case 'vector_flux':
                    break;
                case 'magnet_bloom':
                    this.augmentState.magnetBloomNextCombo = CONFIG.TUNING.augmentTiming.magnetBloomComboStep;
                    break;
                case 'gatecrash_bloom':
                    this.augmentState.gatecrashBloomCount = 0;
                    break;
                case 'prism_coil':
                    this.augmentState.prismCoilCount = 0;
                    this.augmentState.prismCoilActiveMs = 0;
                    break;
                case 'chromatic_aegis':
                    this.augmentState.chromaticAegisCharges = 0;
                    this.augmentState.aegisShardCounter = 0;
                    break;
                case 'photon_weave':
                    this.augmentState.photonWeaveTimerMs = 0;
                    this.augmentState.photonWeaveStacks = 0;
                    break;
            }

            this.runStats = this.buildRunStats();
            this.applyRunStats();
            this.overdriveDurationMs = this.runStats.overdriveDurationMs;
        }

        updateScoreDisplay(): void {
            this.ui.updateScore(this.score);
        }

        updateComboDisplay(): void {
            this.ui.updateCombo(this.comboCount);
        }

        updateHighScoreDisplay(): void {
            this.ui.updateHighScore(this.highScore);
        }

        updateSkinDisplay(): void {
            const skin = this.skinManager.getCurrentSkin();
            this.ui.updateSkin(skin.name);
        }

        updateSoundUI(): void {
            const muteBtn = document.getElementById('mute-btn');
            const soundBtn = document.getElementById('sound-btn');
            if (muteBtn) {
                muteBtn.classList.toggle('muted', !this.soundManager.enabled);
                muteBtn.setAttribute('aria-pressed', (!this.soundManager.enabled).toString());
                muteBtn.setAttribute('aria-label', this.soundManager.enabled ? 'Mute sound' : 'Unmute sound');
            }
            if (soundBtn) soundBtn.textContent = `SOUND: ${this.soundManager.enabled ? 'ON' : 'OFF'}`;
        }

        refreshMetaUI(): void {
            const daily = this.metaStore.ensureDailyChallenge();
            const today = getLocalDateKey();
            const dailyBoard = this.metaStore.data.leaderboard.daily;
            const useDaily = dailyBoard && dailyBoard.date === today && dailyBoard.entries.length > 0;
            const list = useDaily ? dailyBoard.entries : this.metaStore.data.leaderboard.allTime;
            this.ui.updateDailyChallenge(daily, useDaily);
            this.ui.renderLeaderboard(list);
            this.ui.updateMeta();

            if (this.metaStore.data.lastShareCode) {
                this.ui.updateShareStatus(`LAST CODE: ${this.metaStore.data.lastShareCode}`, true);
            } else {
                this.ui.updateShareStatus('NO SHARE YET', true);
            }
        }

        updatePauseUI(): void {
            const pauseIndicator = document.getElementById('pause-indicator');
            const pauseMenu = document.getElementById('pause-menu');
            const pauseButton = document.getElementById('pause-btn');
            if (pauseIndicator) pauseIndicator.style.display = this.isPaused ? 'block' : 'none';
            if (pauseMenu) pauseMenu.style.display = this.isPaused ? 'flex' : 'none';
            if (pauseButton) {
                pauseButton.setAttribute('aria-pressed', this.isPaused.toString());
                pauseButton.setAttribute('aria-label', this.isPaused ? 'Resume run' : 'Pause run');
            }
        }

        togglePause(forceState?: boolean): void {
            if (!this.isRunning) return;
            if (this.augmentSelectionActive) return;
            this.isPaused = typeof forceState === 'boolean' ? forceState : !this.isPaused;
            this.updatePauseUI();
            this.input?.setPaused(this.isPaused);
            this.soundManager.setPauseDucking(this.isPaused);
            this.ui.announce(this.isPaused ? 'Run paused.' : 'Run resumed.');
            if (this.isPaused) {
                document.getElementById('resume-btn')?.focus();
            } else {
                this.lastTime = performance.now();
                this.canvas.focus();
            }
        }

        toggleFps(): void {
            this.showFps = !this.showFps;
            this.ui.showFps(this.showFps);
        }

        toggleSound(): void {
            this.soundManager.setEnabled(!this.soundManager.enabled);
            this.updateSoundUI();
        }

        async toggleFullscreen(): Promise<void> {
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (error) {
                return;
            }
        }

        quitToStart(): void {
            this.isRunning = false;
            this.isPaused = false;
            this.stopAnimationLoop();
            this.input?.setEnabled(false);
            this.input?.setPaused(false);
            this.setTouchControlsVisible(false);
            this.showStartScreen();
        }

        showStartScreen(): void {
            this.ui.showScreen(this.ui.el.startScreen);
            this.isPaused = false;
            this.updatePauseUI();
            this.input?.setEnabled(false);
            this.input?.setPaused(false);
            this.setTouchControlsVisible(false);
            this.soundManager.playMenuMusic();
            this.soundManager.setPauseDucking(false);
            this.ui.announce('Solar Drift ready. Choose one of three run modes.');
        }

        showSkinSelector(): void {
            this.ui.showScreen(this.ui.el.skinScreen);
            const renderSkins = (): void => {
                this.ui.renderSkinCards(this.skinManager, (key: string) => {
                    this.skinManager.setSkin(key);
                    this.updateSkinDisplay();
                    renderSkins();
                });
            };
            renderSkins();
        }

        showArmory(): void {
            this.ui.showScreen(this.ui.el.armoryScreen);
            const renderArmory = (): void => {
                this.ui.renderUpgrades(UPGRADES, this.metaStore, (id: string) => {
                    const result = this.metaStore.purchaseUpgrade(id);
                    if (result.success) {
                        renderArmory();
                        this.refreshMetaUI();
                    }
                });
            };
            renderArmory();
            this.ui.updateMeta();
        }

        updateFps(deltaTime: number, currentTime: number): void {
            const fps = CONFIG.TUNING.time.msPerSecond / Math.max(1, deltaTime);
            const { downshiftFps, upshiftFps, downshiftLockMs, upshiftLockMs, sampleCount } = CONFIG.TUNING.qualityAuto;
            this.fpsSamples.push(fps);
            while (this.fpsSamples.length > sampleCount) {
                this.fpsSamples.shift();
            }
            if (currentTime - this.lastFpsUpdate >= CONFIG.FPS_SAMPLE_WINDOW) {
                const avg = this.fpsSamples.reduce((sum, value) => sum + value, 0) / this.fpsSamples.length;
                this.ui.updateFpsLabel(avg);
                if (this.autoQuality && this.qualityLockMs <= 0) {
                    if (avg < downshiftFps && this.qualityTier < CONFIG.TUNING.qualityAuto.maxDownshiftTier) {
                        this.applyQualityTier(this.qualityTier + 1);
                        this.qualityLockMs = downshiftLockMs;
                    } else if (avg > upshiftFps && this.qualityTier > 0) {
                        this.applyQualityTier(this.qualityTier - 1);
                        this.qualityLockMs = upshiftLockMs;
                    }
                }
                this.lastFpsUpdate = currentTime;
            }
            if (this.qualityLockMs > 0) {
                this.qualityLockMs = Math.max(0, this.qualityLockMs - deltaTime);
            }
        }

        updateComboOnEat(): void {
            const now = this.elapsedTimeMs;
            if (now - this.lastEatTime <= this.comboWindowMs) {
                this.comboCount += 1;
            } else {
                this.comboCount = 1;
                if (this.activeAugmentFlags.magnet_bloom) {
                    this.augmentState.magnetBloomNextCombo = CONFIG.TUNING.augmentTiming.magnetBloomComboStep;
                }
            }
            this.lastEatTime = now;
            if (this.comboCount > this.maxCombo) {
                this.maxCombo = this.comboCount;
            }
            this.updateComboDisplay();
            if (
                this.activeAugmentFlags.combo_weave
                && this.comboCount >= CONFIG.TUNING.augmentTiming.comboWeaveMinCombo
                && this.comboCount % CONFIG.TUNING.augmentTiming.comboWeavePulseEvery === 0
                && this.snake
            ) {
                const pulse = CONFIG.TUNING.fx.pulses.comboWeaveSignature;
                const head = this.snake.getHead();
                const x = head.x * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                const y = head.y * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2;
                this.emitSignaturePulse('combo_weave', x, y, pulse.radius, pulse.duration, pulse.thickness);
            }
        }

        updateComboDecay(): void {
            if (this.comboCount === 0) return;
            const now = this.elapsedTimeMs;
            if (now - this.lastEatTime > this.comboWindowMs) {
                this.comboCount = 0;
                this.updateComboDisplay();
                if (this.activeAugmentFlags.magnet_bloom) {
                    this.augmentState.magnetBloomNextCombo = CONFIG.TUNING.augmentTiming.magnetBloomComboStep;
                }
            }
        }

        getComboMultiplier(): number {
            if (this.comboCount <= 1) return 1;
            const maxBonus = (this.mode.combo.maxBonus || CONFIG.MAX_COMBO_BONUS) + this.runModifiers.comboMaxBonusBonus;
            const bonus = Math.min((this.comboCount - 1) * CONFIG.TUNING.combo.bonusPerStep, maxBonus);
            return 1 + bonus;
        }

        getParticleCount(baseCount: number): number {
            const quality = QUALITY_TIERS[this.qualityTier];
            return Math.max(6, Math.floor(baseCount * quality.particleScale));
        }

        drawPowerUpUI(): void {
            if (!this.snake) return;
            const activePowerUps = this.snake.getActivePowerUps(this.elapsedTimeMs);
            if (activePowerUps.length === 0) return;
            const ctx = this.ctx;
            const powerUpUi = CONFIG.TUNING.powerUpUi;
            const startX = CONFIG.CANVAS_WIDTH - powerUpUi.offsetX;
            const startY = powerUpUi.startY;
            const barWidth = powerUpUi.barWidth;
            const barHeight = powerUpUi.barHeight;
            const spacing = powerUpUi.spacing;
            ctx.save();
            activePowerUps.forEach((powerUp, index) => {
                const y = startY + index * spacing;
                const progress = powerUp.progress;
                ctx.font = '12px "Space Mono", monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fff4e6';
                ctx.fillText(powerUp.icon, startX - powerUpUi.iconOffsetX, y + barHeight / 2);

                ctx.fillStyle = `rgba(255, 255, 255, ${powerUpUi.barBackgroundAlpha})`;
                ctx.fillRect(startX, y, barWidth, barHeight);

                ctx.fillStyle = powerUp.color;
                ctx.shadowBlur = powerUpUi.glowShadowBlur;
                ctx.shadowColor = powerUp.color;
                ctx.fillRect(startX, y, barWidth * progress, barHeight);

                ctx.font = '10px "Space Mono", monospace';
                ctx.fillStyle = powerUp.color;
                ctx.shadowBlur = 0;
                ctx.textAlign = 'right';
                const seconds = Math.ceil(powerUp.remaining / CONFIG.TUNING.time.msPerSecond);
                ctx.fillText(`${seconds}s`, startX + barWidth + powerUpUi.timerOffsetX, y + barHeight / 2);
            });
            ctx.restore();
        }

        triggerFlash(color: string, intensity: number): void {
            this.flashColor = hexToRgb(color);
            this.flashAlpha = Math.min(CONFIG.TUNING.flash.maxAlpha, this.flashAlpha + intensity);
        }

        updateFlash(deltaTime: number): void {
            if (this.flashAlpha <= 0) return;
            this.flashAlpha = Math.max(0, this.flashAlpha - deltaTime * CONFIG.TUNING.flash.decayPerMs);
        }

        drawFlash(): void {
            if (this.flashAlpha <= 0) return;
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'screen';
            this.ctx.fillStyle = rgbToRgba(this.flashColor, this.flashAlpha);
            this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
            this.ctx.restore();
        }

        generateRunId(): string {
            const runId = CONFIG.TUNING.runId;
            const randomSegment = Math.random()
                .toString(runId.radix)
                .slice(runId.sliceStart, runId.sliceStart + runId.sliceLength);
            return `run-${Date.now().toString(runId.radix)}-${randomSegment}`;
        }

        updateShareStatus(message: string, isSuccess = true): void {
            this.ui.updateShareStatus(message, isSuccess);
        }

        importShareCode(): void {
            const input = document.getElementById('share-code-input');
            if (!(input instanceof HTMLInputElement)) return;
            const raw = input.value.trim();
            if (!raw) {
                this.updateShareStatus('PASTE A SHARE CODE FIRST', false);
                return;
            }
            const prefix = CONFIG.SHARE_CODE_PREFIX;
            const token = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
            try {
                const payload = decodeSharePayload<{ v?: unknown; replay?: unknown }>(token);
                if (!payload || payload.v !== 2) throw new Error('Invalid payload version');
                const replay = parseRunSummary(payload.replay, this.generateRunId());
                if (!replay) throw new Error('Invalid run summary');
                replay.importedAt = Date.now();
                this.metaStore.data.replays.unshift(replay);
                this.metaStore.data.replays = this.metaStore.data.replays.slice(0, CONFIG.REPLAY_LIMIT);
                this.metaStore.save();
                input.value = '';
                this.updateShareStatus('RUN SUMMARY IMPORTED', true);
            } catch (error) {
                this.updateShareStatus('INVALID SHARE CODE', false);
            }
        }

        async copyLastShareCode(): Promise<void> {
            const code = this.metaStore.data.lastShareCode;
            if (!code) {
                this.updateShareStatus('NO SHARE CODE YET', false);
                return;
            }
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(code);
                    this.updateShareStatus('SHARE CODE COPIED', true);
                } else {
                    this.updateShareStatus('CLIPBOARD NOT AVAILABLE', false);
                }
            } catch (error) {
                this.updateShareStatus('COPY FAILED', false);
            }
        }
    }

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    window.render_game_to_text = () => game.renderGameToText();
    window.advanceTime = (ms: number) => game.advanceTime(ms);
});
