export interface Vector2 {
  x: number;
  y: number;
}

export interface SurgeConfig {
  cooldownMs: number;
  durationMs: number;
  lockMs: number;
  speedMultiplier: number;
  scoreBoostMs: number;
}

export interface OverdriveConfig {
  durationMs: number;
  scoreMultiplier: number;
  speedMultiplier: number;
  fillRate: number;
  decayRate: number;
}

export interface NearMissConfig {
  cooldownMs: number;
  points: number;
  shard: number;
}

export interface LoadingConfig {
  startDelayMs: number;
  stepDelayMs: number;
  progressStep: number;
  maxProgress: number;
}

export interface TimeConfig {
  msPerSecond: number;
}

export interface CanvasConfig {
  displayPadding: number;
}

export interface UiTuningConfig {
  playerTagMaxLength: number;
}

export interface QualityAutoConfig {
  downshiftFps: number;
  upshiftFps: number;
  downshiftLockMs: number;
  upshiftLockMs: number;
  sampleCount: number;
  maxDownshiftTier: number;
}

export interface QualityTuningConfig {
  defaultTier: number;
  lowQualityTierMin: number;
  particleBaseLimit: number;
}

export interface AudioTuningConfig {
  gameOverMixIntensity: number;
}

export interface HazardTuningConfig {
  overdriveBonus: number;
}

export interface RunRewardConfig {
  shardScoreFactor: number;
  shardComboFactor: number;
  shardAugmentStageFactor: number;
}

export interface ReviveConfig {
  graceMs: number;
  aegisGraceMs: number;
}

export interface AugmentSelectionConfig {
  choices: number;
  stageBonus: number;
}

export interface PrecisionConfig {
  threshold: number;
  vectorFluxThreshold: number;
  bonusBase: number;
  bonusScale: number;
  adrenalineGain: number;
  surgeCooldownCutMs: number;
  shardBonus: number;
}

export interface MagnetConfig {
  basePullStrength: number;
  bloomPullStrength: number;
  coilPullStrength: number;
  bloomBonusRange: number;
  coilBonusRange: number;
  minDistanceTiles: number;
}

export interface PowerUpUiConfig {
  offsetX: number;
  startY: number;
  barWidth: number;
  barHeight: number;
  spacing: number;
  iconOffsetX: number;
  timerOffsetX: number;
  barBackgroundAlpha: number;
  glowShadowBlur: number;
}

export interface FlashConfig {
  maxAlpha: number;
  decayPerMs: number;
}

export interface NearMissDetectionConfig {
  wallBuffer: number;
  hazardDistance: number;
  adrenalineGain: number;
}

export interface CollectibleSpawnConfig {
  foodAttempts: number;
  powerUpAttempts: number;
  hazardAttempts: number;
}

export interface PowerupChanceClamp {
  min: number;
  max: number;
}

export interface PulseConfig {
  radius: number;
  duration: number;
  thickness: number;
}

export interface AuraRingConfig {
  alpha: number;
  radius: number;
}

export interface FxAurasConfig {
  ringSpacing: number;
  lineWidth: number;
  rings: Record<string, AuraRingConfig>;
}

export interface FxGateRewardDotConfig {
  radius: number;
  shadowBlur: number;
}

export interface FxConfig {
  pulses: Record<string, PulseConfig>;
  particles: Record<string, number>;
  flashes: Record<string, number>;
  auras: FxAurasConfig;
  gateRewardDot: FxGateRewardDotConfig;
}

export interface FoodShardBaseConfig {
  basic: number;
  bonus: number;
  super: number;
  volatile: number;
}

export interface GatecrashBloomScoringConfig {
  bonusBase: number;
  bonusComboFactor: number;
  shardBonus: number;
}

export interface OverdriveResonatorScoringConfig {
  warningShardMin: number;
  warningShardMax: number;
}

export interface AugmentFoodScoringConfig {
  prismEchoMultiplier: number;
  prismEchoShardBonus: number;
  prismCoilMultiplier: number;
  prismCoilShardBonus: number;
  lumenShardBonus: number;
  lumenAdrenalineGain: number;
  photonWeaveMultiplier: number;
  kaleidosurgeMultiplier: number;
}

export interface ScoringTuningConfig {
  foodShardBase: FoodShardBaseConfig;
  gatecrashBloom: GatecrashBloomScoringConfig;
  overdriveResonator: OverdriveResonatorScoringConfig;
  augmentFood: AugmentFoodScoringConfig;
}

export interface AugmentEffectsConfig {
  spectrum_signatures: {
    maxScoreBonus: number;
    bonusPerAugment: number;
    bonusStep: number;
  };
  overclock: {
    overdriveFillBonus: number;
    overdriveDurationBonusMs: number;
  };
  ion_prism: {
    scoreMultiplier: number;
    nearMissBonus: number;
  };
  combo_weave: {
    comboWindowBonusMs: number;
    comboMaxBonusBonus: number;
  };
  magnetic_bloom: {
    magnetRangeBonus: number;
  };
  gate_bounty: {
    gateRewardBonus: number;
    gateChainBonus: number;
    gateShardBonus: number;
  };
  surge_vector: {
    cooldownScaleMultiplier: number;
    cooldownScaleMin: number;
    scoreBoost: number;
  };
  ghost_mesh: {
    reviveChargesBonus: number;
    reviveGhostBonusMs: number;
  };
  volatile_alchemy: {
    volatileBonus: number;
    volatileShardBonus: number;
  };
  pulse_harvest: {
    powerupShardBonus: number;
    powerupExtendOverdriveMs: number;
  };
  hazard_forge: {
    hazardMaxBonus: number;
    nearMissShardBonus: number;
  };
}

export interface UpgradeTuningConfig {
  fluxPowerupChance: number;
  comboWindowMs: number;
  overdriveDurationMs: number;
}

export interface RunIdConfig {
  radix: number;
  sliceStart: number;
  sliceLength: number;
}

export interface GameOverConfig {
  screenDelayMs: number;
}

export interface OverdriveMixConfig {
  intensityBase: number;
  speedWeight: number;
  comboWeight: number;
  hazardWeight: number;
  comboScale: number;
  gainSpeed: number;
  gainCombo: number;
  gainHazard: number;
  musicUpdateMs: number;
}

export interface OverdriveFxConfig {
  aberration: number;
}

export interface ComboTuningConfig {
  bonusPerStep: number;
}

export interface AugmentTimingConfig {
  lumenActiveMs: number;
  lumenTickMs: number;
  prismEchoCount: number;
  prismEchoActiveMs: number;
  prismCoilCount: number;
  prismCoilActiveMs: number;
  magnetBloomActiveMs: number;
  magnetBloomComboStep: number;
  gatecrashBloomCount: number;
  comboWeavePulseEvery: number;
  comboWeaveMinCombo: number;
  photonWeaveIntervalMs: number;
  photonWeaveMaxStacks: number;
  photonWeaveStackBoostMs: number;
  photonWeaveMaxBoostMs: number;
  kaleidoSurgeBudgetMs: number;
  kaleidoSurgeExtendMs: number;
  overdriveBonusBudgetMs: number;
  overdriveBonusExtendMs: number;
  overdriveBonusMaxMs: number;
  chromaticAegisShardStep: number;
  chromaticAegisMaxCharges: number;
}

export interface TuningConfig {
  canvas: CanvasConfig;
  ui: UiTuningConfig;
  quality: QualityTuningConfig;
  audio: AudioTuningConfig;
  hazards: HazardTuningConfig;
  fx: FxConfig;
  time: TimeConfig;
  runId: RunIdConfig;
  loading: LoadingConfig;
  qualityAuto: QualityAutoConfig;
  runRewards: RunRewardConfig;
  scoring: ScoringTuningConfig;
  augmentEffects: AugmentEffectsConfig;
  revive: ReviveConfig;
  augmentSelection: AugmentSelectionConfig;
  precision: PrecisionConfig;
  magnet: MagnetConfig;
  powerUpUi: PowerUpUiConfig;
  flash: FlashConfig;
  nearMiss: NearMissDetectionConfig;
  collectibles: CollectibleSpawnConfig;
  powerupChanceClamp: PowerupChanceClamp;
  upgrades: UpgradeTuningConfig;
  gameOver: GameOverConfig;
  overdriveMix: OverdriveMixConfig;
  overdriveFx: OverdriveFxConfig;
  combo: ComboTuningConfig;
  augmentTiming: AugmentTimingConfig;
}

export interface Config {
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  GRID_SIZE: number;
  INITIAL_SPEED: number;
  MIN_SPEED: number;
  SPEED_DECREMENT: number;
  POWERUP_SPAWN_CHANCE: number;
  MAGNET_RANGE: number;
  COMBO_WINDOW: number;
  MAX_COMBO_BONUS: number;
  FPS_SAMPLE_WINDOW: number;
  BACKDROP_ORB_COUNT: number;
  META_STORAGE_KEY: string;
  META_VERSION: number;
  DAILY_TARGETS: number[];
  LEADERBOARD_LIMIT: number;
  REPLAY_LIMIT: number;
  MAX_REPLAY_INPUTS: number;
  SHARE_CODE_PREFIX: string;
  DEFAULT_MODE: string;
  AUGMENT_STEP_START: number;
  AUGMENT_STEP_INC: number;
  SURGE: SurgeConfig;
  OVERDRIVE: OverdriveConfig;
  NEAR_MISS: NearMissConfig;
  TUNING: TuningConfig;
}

export interface QualityTier {
  name: string;
  bloom: boolean;
  blur: number;
  downsample: number;
  intensity: number;
  particleScale: number;
  backdropOrbs: number;
  scanlines: boolean;
  noiseStrength: number;
}

export interface ModeSpeedConfig {
  start: number;
  min: number;
  rampScore: number;
  curve: 'easeOutCubic' | 'linear';
}

export interface ModeComboConfig {
  window: number;
  maxBonus: number;
}

export interface ModePowerupConfig {
  chance: number;
}

export interface ModeHazardConfig {
  spawnStep: number;
  max: number;
  warningMs: number;
  activeMs: number;
}

export interface ModeVolatileConfig {
  enabled: boolean;
  ttlMs: number;
  bonus: number;
  detonateHazardMs: number;
}

export interface ModeGateRewardConfig {
  enabled: boolean;
  ttlMs: number;
  points: number;
  chainBonus: number;
}

export interface ModeDef {
  label: string;
  desc: string;
  speed: ModeSpeedConfig;
  combo: ModeComboConfig;
  powerups: ModePowerupConfig;
  hazards: ModeHazardConfig;
  foodWeights: Record<string, number>;
  volatile: ModeVolatileConfig;
  gateReward: ModeGateRewardConfig;
}

export type ModeDefs = Record<string, ModeDef>;

export interface PowerUpType {
  name: string;
  color: string;
  glow: string;
  icon: string;
  duration: number;
  multiplier: number;
}

export type PowerUpTypeMap = Record<string, PowerUpType>;

export interface FoodType {
  name: string;
  points: number;
  spawnChance: number;
  color: string;
  glowColor: string;
  pulseSpeed: number;
  particleColor: string;
}

export type FoodTypeMap = Record<string, FoodType>;

export interface Skin {
  name: string;
  head: string;
  body: string;
  glow: string;
  trail: string;
  particles: string;
  unlockAt: number;
  preview: [string, string];
}

export type SkinMap = Record<string, Skin>;

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  max: number;
  baseCost: number;
  costScale: number;
}

export interface Augment {
  id: string;
  name: string;
  desc: string;
  rarity: 'common' | 'rare';
}

export type AugmentColorMap = Record<string, string>;

export interface LeaderboardEntry {
  id: string;
  tag: string;
  score: number;
  timeMs: number;
  time: string;
  date: string;
  mode: string;
}

export interface ReplayData {
  id: string;
  createdAt: number;
  mode: string;
  score: number;
  durationMs: number;
  maxCombo: number;
  foodEaten: number;
  length: number;
  augments: string[];
  shards: number;
  shareCode?: string;
  importedAt?: number;
}

export interface DailyChallenge {
  date: string;
  seed: number;
  targetScore: number;
  bestScore: number;
  completedAt: number | null;
}

export interface LeaderboardData {
  allTime: LeaderboardEntry[];
  daily: {
    date: string;
    entries: LeaderboardEntry[];
  };
}

export interface MetaData {
  version: number;
  playerTag: string;
  shards: number;
  xp: number;
  level: number;
  highScore: number;
  upgrades: Record<string, number>;
  unlockedSkins: string[];
  currentSkin: string;
  daily: DailyChallenge;
  leaderboard: LeaderboardData;
  replays: ReplayData[];
  lastShareCode: string;
}

export interface LegacyNeonSnake {
  CONFIG: Config;
  QUALITY_TIERS: QualityTier[];
  MODE_DEFS: ModeDefs;
  POWERUP_TYPES: PowerUpTypeMap;
  FOOD_TYPES: FoodTypeMap;
  SKINS: SkinMap;
  UPGRADES: Upgrade[];
  AUGMENTS: Augment[];
  AUGMENT_COLORS: AugmentColorMap;
  utils?: Record<string, unknown>;
  Vector2D?: unknown;
  COLORS?: Record<string, string>;
  MetaStore?: unknown;
  SkinManager?: unknown;
  GlowRenderer?: unknown;
  PostFxRenderer?: unknown;
  Grid?: unknown;
  NeonBackdrop?: unknown;
  SkylineLayer?: unknown;
  ScreenShake?: unknown;
  PulseSystem?: unknown;
  ParticleSystem?: unknown;
  SoundManager?: unknown;
  PowerUp?: unknown;
  Food?: unknown;
  Hazard?: unknown;
  Snake?: unknown;
  UIManager?: unknown;
  InputManager?: unknown;
}

export interface GameState {
  isRunning: boolean;
  isPaused: boolean;
  score: number;
  highScore: number;
  comboCount: number;
  maxCombo: number;
  elapsedTimeMs: number;
  runShards: number;
  overdriveActive: boolean;
  overdriveRemainingMs: number;
  surgeRemainingMs: number;
}

export interface EntityState {
  position: Vector2;
}

export interface FoodState extends EntityState {
  type: FoodType;
}

export interface PowerUpState extends EntityState {
  type: PowerUpType;
}

export interface HazardState extends EntityState {
  state: 'warning' | 'active';
}
