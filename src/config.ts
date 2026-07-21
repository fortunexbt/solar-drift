import type {
  Augment,
  AugmentColorMap,
  Config,
  FoodTypeMap,
  LegacyNeonSnake,
  ModeDefs,
  PowerUpTypeMap,
  QualityTier,
  SkinMap,
  Upgrade
} from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

export const CONFIG: Config = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  GRID_SIZE: 20,
  INITIAL_SPEED: 106,
  MIN_SPEED: 38,
  SPEED_DECREMENT: 2,
  POWERUP_SPAWN_CHANCE: 0.2,
  MAGNET_RANGE: 5,
  COMBO_WINDOW: 2400,
  MAX_COMBO_BONUS: 0.55,
  FPS_SAMPLE_WINDOW: 500,
  BACKDROP_ORB_COUNT: 10,
  META_STORAGE_KEY: 'neonSnakeMeta',
  META_VERSION: 2,
  DAILY_TARGETS: [220, 260, 320, 380, 450, 520, 600],
  LEADERBOARD_LIMIT: 5,
  REPLAY_LIMIT: 20,
  MAX_REPLAY_INPUTS: 7000,
  SHARE_CODE_PREFIX: 'NS-',
  DEFAULT_MODE: 'classic',
  AUGMENT_STEP_START: 160,
  AUGMENT_STEP_INC: 130,
  SURGE: {
    cooldownMs: 7000,
    durationMs: 850,
    lockMs: 200,
    speedMultiplier: 0.6,
    scoreBoostMs: 1200
  },
  OVERDRIVE: {
    durationMs: 9000,
    scoreMultiplier: 1.22,
    speedMultiplier: 0.82,
    fillRate: 0.12,
    decayRate: 0.04
  },
  NEAR_MISS: {
    cooldownMs: 260,
    points: 6,
    shard: 1
  },
  TUNING: {
    canvas: {
      displayPadding: 40
    },
    ui: {
      playerTagMaxLength: 12
    },
    quality: {
      defaultTier: 1,
      lowQualityTierMin: 2,
      particleBaseLimit: 700
    },
    audio: {
      gameOverMixIntensity: 0.1
    },
    hazards: {
      overdriveBonus: 1
    },
    fx: {
      pulses: {
        chromaticAegisGain: { radius: 140, duration: 500, thickness: 4 },
        chromaticAegisShield: { radius: 180, duration: 700, thickness: 5 },
        photonWeaveGain: { radius: 120, duration: 520, thickness: 3 },
        photonWeaveBoost: { radius: 180, duration: 700, thickness: 4 },
        gateReward: { radius: 90, duration: 300, thickness: 3 },
        gatecrashBloom: { radius: 160, duration: 520, thickness: 3 },
        gateBounty: { radius: 120, duration: 380, thickness: 3 },
        overdriveResonatorStart: { radius: 200, duration: 650, thickness: 4 },
        overdriveResonatorEnd: { radius: 240, duration: 700, thickness: 5 },
        overclockSignature: { radius: 160, duration: 520, thickness: 3 },
        kaleidosurgeWake: { radius: 160, duration: 550, thickness: 3 },
        surgeVector: { radius: 140, duration: 420, thickness: 3 },
        volatileAlchemy: { radius: 180, duration: 520, thickness: 4 },
        prismEcho: { radius: 180, duration: 600, thickness: 4 },
        prismCoil: { radius: 200, duration: 650, thickness: 4 },
        magnetBloom: { radius: 160, duration: 540, thickness: 3 },
        foodBasic: { radius: 120, duration: 450, thickness: 3 },
        foodBonus: { radius: 170, duration: 600, thickness: 4 },
        foodSuper: { radius: 230, duration: 750, thickness: 5 },
        powerUp: { radius: 260, duration: 900, thickness: 5 },
        magneticBloomSignature: { radius: 140, duration: 420, thickness: 3 },
        pulseHarvestSignature: { radius: 160, duration: 520, thickness: 3 },
        precision: { radius: 90, duration: 240, thickness: 2 },
        vectorFlux: { radius: 120, duration: 360, thickness: 3 },
        comboWeaveSignature: { radius: 100, duration: 320, thickness: 2 },
        lumenRelay: { radius: 160, duration: 520, thickness: 3 },
        ionPrismSignature: { radius: 120, duration: 380, thickness: 3 },
        hazardForgeSignature: { radius: 120, duration: 380, thickness: 3 },
        ghostMeshSignature: { radius: 180, duration: 600, thickness: 4 },
        gameOver: { radius: 320, duration: 1100, thickness: 6 }
      },
      particles: {
        foodSuper: 25,
        foodStandard: 15,
        powerUpExplosion: 35,
        powerUpSpark: 20,
        augmentTrailPrismEcho: 6,
        augmentTrailKaleidosurge: 6,
        gameOverExplosion: 40
      },
      flashes: {
        chromaticAegisGain: 0.18,
        chromaticAegisShield: 0.28,
        overdrive: 0.4,
        surge: 0.25,
        volatile: 0.25,
        foodBasic: 0.12,
        foodBonus: 0.2,
        foodSuper: 0.3,
        powerUp: 0.35,
        revive: 0.3,
        gameOver: 0.45
      },
      auras: {
        ringSpacing: 3,
        lineWidth: 2,
        rings: {
          lumenRelay: { alpha: 0.25, radius: 18 },
          prismEcho: { alpha: 0.28, radius: 22 },
          prismCoil: { alpha: 0.3, radius: 26 },
          magnetBloom: { alpha: 0.22, radius: 20 },
          photonWeave: { alpha: 0.28, radius: 24 },
          chromaticAegis: { alpha: 0.35, radius: 30 }
        }
      },
      gateRewardDot: {
        radius: 4,
        shadowBlur: 15
      }
    },
    time: {
      msPerSecond: 1000
    },
    runId: {
      radix: 36,
      sliceStart: 2,
      sliceLength: 5
    },
    loading: {
      startDelayMs: 300,
      stepDelayMs: 250,
      progressStep: 20,
      maxProgress: 100
    },
    qualityAuto: {
      downshiftFps: 55,
      upshiftFps: 63,
      downshiftLockMs: 3000,
      upshiftLockMs: 5000,
      sampleCount: 60,
      maxDownshiftTier: 2
    },
    runRewards: {
      shardScoreFactor: 0.02,
      shardComboFactor: 2,
      shardAugmentStageFactor: 4
    },
    scoring: {
      foodShardBase: {
        basic: 1,
        bonus: 2,
        super: 3,
        volatile: 3
      },
      gatecrashBloom: {
        bonusBase: 12,
        bonusComboFactor: 2,
        shardBonus: 1
      },
      overdriveResonator: {
        warningShardMin: 1,
        warningShardMax: 3
      },
      augmentFood: {
        prismEchoMultiplier: 0.25,
        prismEchoShardBonus: 2,
        prismCoilMultiplier: 0.35,
        prismCoilShardBonus: 2,
        lumenShardBonus: 2,
        lumenAdrenalineGain: 0.12,
        photonWeaveMultiplier: 0.25,
        kaleidosurgeMultiplier: 0.2
      }
    },
    augmentEffects: {
      spectrum_signatures: {
        maxScoreBonus: 0.05,
        bonusPerAugment: 0.01,
        bonusStep: 0.01
      },
      overclock: {
        overdriveFillBonus: 0.3,
        overdriveDurationBonusMs: 2000
      },
      ion_prism: {
        scoreMultiplier: 0.1,
        nearMissBonus: 6
      },
      combo_weave: {
        comboWindowBonusMs: 400,
        comboMaxBonusBonus: 0.05
      },
      magnetic_bloom: {
        magnetRangeBonus: 2
      },
      gate_bounty: {
        gateRewardBonus: 15,
        gateChainBonus: 6,
        gateShardBonus: 1
      },
      surge_vector: {
        cooldownScaleMultiplier: 0.7,
        cooldownScaleMin: 0.6,
        scoreBoost: 0.15
      },
      ghost_mesh: {
        reviveChargesBonus: 1,
        reviveGhostBonusMs: 800
      },
      volatile_alchemy: {
        volatileBonus: 20,
        volatileShardBonus: 2
      },
      pulse_harvest: {
        powerupShardBonus: 2,
        powerupExtendOverdriveMs: 1200
      },
      hazard_forge: {
        hazardMaxBonus: 1,
        nearMissShardBonus: 1
      }
    },
    revive: {
      graceMs: 1400,
      aegisGraceMs: 900
    },
    augmentSelection: {
      choices: 3,
      stageBonus: 20
    },
    precision: {
      threshold: 0.7,
      vectorFluxThreshold: 0.6,
      bonusBase: 4,
      bonusScale: 8,
      adrenalineGain: 0.05,
      surgeCooldownCutMs: 250,
      shardBonus: 1
    },
    magnet: {
      basePullStrength: 0.1,
      bloomPullStrength: 0.16,
      coilPullStrength: 0.13,
      bloomBonusRange: 2,
      coilBonusRange: 2,
      minDistanceTiles: 1
    },
    powerUpUi: {
      offsetX: 160,
      startY: 90,
      barWidth: 110,
      barHeight: 8,
      spacing: 30,
      iconOffsetX: 30,
      timerOffsetX: 20,
      barBackgroundAlpha: 0.2,
      glowShadowBlur: 10
    },
    flash: {
      maxAlpha: 0.7,
      decayPerMs: 0.0012
    },
    nearMiss: {
      wallBuffer: 1,
      hazardDistance: 1,
      adrenalineGain: 0.05
    },
    collectibles: {
      foodAttempts: 120,
      powerUpAttempts: 120,
      hazardAttempts: 150
    },
    powerupChanceClamp: {
      min: 0.05,
      max: 0.5
    },
    upgrades: {
      fluxPowerupChance: 0.03,
      comboWindowMs: 200,
      overdriveDurationMs: 2000
    },
    gameOver: {
      screenDelayMs: 500
    },
    overdriveMix: {
      intensityBase: 0.2,
      speedWeight: 0.45,
      comboWeight: 0.25,
      hazardWeight: 0.2,
      comboScale: 8,
      gainSpeed: 0.08,
      gainCombo: 0.1,
      gainHazard: 0.06,
      musicUpdateMs: 160
    },
    overdriveFx: {
      aberration: 2
    },
    combo: {
      bonusPerStep: 0.1
    },
    augmentTiming: {
      lumenActiveMs: 3500,
      lumenTickMs: 160,
      prismEchoCount: 4,
      prismEchoActiveMs: 4500,
      prismCoilCount: 7,
      prismCoilActiveMs: 3000,
      magnetBloomActiveMs: 3600,
      magnetBloomComboStep: 3,
      gatecrashBloomCount: 12,
      comboWeavePulseEvery: 3,
      comboWeaveMinCombo: 2,
      photonWeaveIntervalMs: 9000,
      photonWeaveMaxStacks: 4,
      photonWeaveStackBoostMs: 1400,
      photonWeaveMaxBoostMs: 4200,
      kaleidoSurgeBudgetMs: 2000,
      kaleidoSurgeExtendMs: 200,
      overdriveBonusBudgetMs: 2400,
      overdriveBonusExtendMs: 220,
      overdriveBonusMaxMs: 2400,
      chromaticAegisShardStep: 35,
      chromaticAegisMaxCharges: 2
    }
  }
};

export const QUALITY_TIERS: QualityTier[] = [
  {
    name: 'ULTRA',
    bloom: true,
    blur: 10,
    downsample: 0.5,
    intensity: 0.6,
    particleScale: 1,
    backdropOrbs: 10,
    scanlines: true,
    noiseStrength: 0.1
  },
  {
    name: 'NORMAL',
    bloom: true,
    blur: 7,
    downsample: 0.45,
    intensity: 0.5,
    particleScale: 0.85,
    backdropOrbs: 7,
    scanlines: true,
    noiseStrength: 0.08
  },
  {
    name: 'LOW',
    bloom: false,
    blur: 0,
    downsample: 0.35,
    intensity: 0.35,
    particleScale: 0.6,
    backdropOrbs: 4,
    scanlines: false,
    noiseStrength: 0.06
  },
  {
    name: 'BATTERY',
    bloom: false,
    blur: 0,
    downsample: 0.3,
    intensity: 0.3,
    particleScale: 0.45,
    backdropOrbs: 2,
    scanlines: false,
    noiseStrength: 0.04
  }
];

export const MODE_DEFS: ModeDefs = {
  classic: {
    label: 'CORE DRIFT',
    desc: 'Steady flow with rising hazards',
    speed: { start: 110, min: 48, rampScore: 820, curve: 'easeOutCubic' },
    combo: { window: 2400, maxBonus: 0.55 },
    powerups: { chance: 0.19 },
    hazards: { spawnStep: 120, max: 6, warningMs: 1200, activeMs: 4200 },
    foodWeights: { BASIC: 0.76, BONUS: 0.14, SUPER: 0.06, VOLATILE: 0.04 },
    volatile: { enabled: true, ttlMs: 5200, bonus: 35, detonateHazardMs: 2600 },
    gateReward: { enabled: false, ttlMs: 2500, points: 30, chainBonus: 10 }
  },
  pulse: {
    label: 'RUSH LOOP',
    desc: 'Fast tempo with volatile spikes',
    speed: { start: 96, min: 40, rampScore: 520, curve: 'easeOutCubic' },
    combo: { window: 1900, maxBonus: 0.45 },
    powerups: { chance: 0.24 },
    hazards: { spawnStep: 90, max: 8, warningMs: 900, activeMs: 3600 },
    foodWeights: { BASIC: 0.7, BONUS: 0.17, SUPER: 0.07, VOLATILE: 0.06 },
    volatile: { enabled: true, ttlMs: 4300, bonus: 45, detonateHazardMs: 3000 },
    gateReward: { enabled: false, ttlMs: 2400, points: 35, chainBonus: 12 }
  },
  gatecrash: {
    label: 'GATE RUN',
    desc: 'Thread active gates for rewards',
    speed: { start: 104, min: 42, rampScore: 720, curve: 'easeOutCubic' },
    combo: { window: 2200, maxBonus: 0.5 },
    powerups: { chance: 0.2 },
    hazards: { spawnStep: 100, max: 9, warningMs: 1100, activeMs: 3800 },
    foodWeights: { BASIC: 0.74, BONUS: 0.14, SUPER: 0.06, VOLATILE: 0.06 },
    volatile: { enabled: true, ttlMs: 4800, bonus: 40, detonateHazardMs: 2600 },
    gateReward: { enabled: true, ttlMs: 2500, points: 30, chainBonus: 10 }
  }
};

export const POWERUP_TYPES: PowerUpTypeMap = {
  SPEED_BOOST: {
    name: 'SPEED',
    color: '#2bb3b1',
    glow: '#73d8d3',
    icon: 'SPD',
    duration: 5000,
    multiplier: 0.7
  },
  GHOST_MODE: {
    name: 'GHOST',
    color: '#5b8dbb',
    glow: '#8bb6d6',
    icon: 'GHO',
    duration: 8000,
    multiplier: 1
  },
  SCORE_MULTIPLIER: {
    name: '2X',
    color: '#f08a4b',
    glow: '#ffba7d',
    icon: '2X',
    duration: 10000,
    multiplier: 2
  },
  MAGNET: {
    name: 'MAG',
    color: '#6bbf6a',
    glow: '#8fdf90',
    icon: 'MAG',
    duration: 6000,
    multiplier: 1
  }
};

export const FOOD_TYPES: FoodTypeMap = {
  BASIC: {
    name: 'basic',
    points: 10,
    spawnChance: 0.8,
    color: '#f08a4b',
    glowColor: '#ffba7d',
    pulseSpeed: 0.05,
    particleColor: '#f08a4b'
  },
  BONUS: {
    name: 'bonus',
    points: 24,
    spawnChance: 0.12,
    color: '#2bb3b1',
    glowColor: '#73d8d3',
    pulseSpeed: 0.08,
    particleColor: '#2bb3b1'
  },
  SUPER: {
    name: 'super',
    points: 50,
    spawnChance: 0.06,
    color: '#d45f5d',
    glowColor: '#f19a92',
    pulseSpeed: 0.12,
    particleColor: '#d45f5d'
  },
  VOLATILE: {
    name: 'volatile',
    points: 30,
    spawnChance: 0.02,
    color: '#c73a2f',
    glowColor: '#f06d60',
    pulseSpeed: 0.16,
    particleColor: '#c73a2f'
  }
};

export const SKINS: SkinMap = {
  CLASSIC: {
    name: 'Classic',
    head: '#2bb3b1',
    body: '#1f9b98',
    glow: '#73d8d3',
    trail: '#2bb3b1',
    particles: '#2bb3b1',
    unlockAt: 0,
    preview: ['#2bb3b1', '#1f9b98']
  },
  SOLAR: {
    name: 'Solar',
    head: '#f08a4b',
    body: '#e07439',
    glow: '#ffba7d',
    trail: '#f08a4b',
    particles: '#f08a4b',
    unlockAt: 120,
    preview: ['#f08a4b', '#e07439']
  },
  NEBULA: {
    name: 'Nebula',
    head: '#5b8dbb',
    body: '#7aa6c8',
    glow: '#8bb6d6',
    trail: '#7aa6c8',
    particles: '#5b8dbb',
    unlockAt: 300,
    preview: ['#5b8dbb', '#7aa6c8']
  },
  TOXIC: {
    name: 'Toxic',
    head: '#6bbf6a',
    body: '#8fdf90',
    glow: '#6bbf6a',
    trail: '#8fdf90',
    particles: '#6bbf6a',
    unlockAt: 520,
    preview: ['#6bbf6a', '#8fdf90']
  },
  GHOST: {
    name: 'Ghost',
    head: '#f3e9db',
    body: '#e4d7c5',
    glow: '#fff4e6',
    trail: '#e4d7c5',
    particles: '#f3e9db',
    unlockAt: 900,
    preview: ['#f3e9db', '#e4d7c5']
  }
};

export const UPGRADES: Upgrade[] = [
  {
    id: 'startLength',
    name: 'Spare Frames',
    desc: 'Start each run with +1 length',
    max: 5,
    baseCost: 80,
    costScale: 1.65
  },
  {
    id: 'aegis',
    name: 'Aegis Core',
    desc: 'Gain +1 revive charge per run',
    max: 3,
    baseCost: 140,
    costScale: 1.9
  },
  {
    id: 'flux',
    name: 'Flux Tuning',
    desc: '+3% power-up spawn chance',
    max: 5,
    baseCost: 110,
    costScale: 1.6
  },
  {
    id: 'combo',
    name: 'Combo Buffer',
    desc: '+200ms combo grace window',
    max: 5,
    baseCost: 90,
    costScale: 1.55
  },
  {
    id: 'magnet',
    name: 'Magnet Lattice',
    desc: '+1 tile magnet range',
    max: 4,
    baseCost: 100,
    costScale: 1.7
  },
  {
    id: 'surge',
    name: 'Surge Capacitor',
    desc: '+1 surge charge per run',
    max: 3,
    baseCost: 150,
    costScale: 1.8
  },
  {
    id: 'overdrive',
    name: 'Overdrive Cell',
    desc: '+2s overdrive duration',
    max: 4,
    baseCost: 120,
    costScale: 1.7
  }
];

export const AUGMENTS: Augment[] = [
  {
    id: 'overclock',
    name: 'Overclock Reactor',
    desc: 'Overdrive fills faster and lasts longer',
    rarity: 'rare'
  },
  {
    id: 'ion_prism',
    name: 'Ion Prism',
    desc: '+10% score multiplier, near misses grant extra points',
    rarity: 'rare'
  },
  {
    id: 'combo_weave',
    name: 'Combo Weave',
    desc: 'Combo window +400ms, combo bonus grows faster',
    rarity: 'common'
  },
  {
    id: 'magnetic_bloom',
    name: 'Magnetic Bloom',
    desc: '+2 magnet range, magnet pulls power-ups',
    rarity: 'common'
  },
  {
    id: 'gate_bounty',
    name: 'Gate Bounty',
    desc: 'Gate rewards grant extra points and shards',
    rarity: 'common'
  },
  {
    id: 'surge_vector',
    name: 'Surge Vector',
    desc: 'Surge cooldown reduced, surge grants a brief score boost',
    rarity: 'rare'
  },
  {
    id: 'ghost_mesh',
    name: 'Ghost Mesh',
    desc: 'Gain a revive charge, revives grant longer ghost',
    rarity: 'rare'
  },
  {
    id: 'volatile_alchemy',
    name: 'Volatile Alchemy',
    desc: 'Volatile food worth more and detonations spawn shards',
    rarity: 'common'
  },
  {
    id: 'pulse_harvest',
    name: 'Pulse Harvest',
    desc: 'Power-ups grant shards and extend overdrive',
    rarity: 'common'
  },
  {
    id: 'hazard_forge',
    name: 'Hazard Forge',
    desc: '+1 hazard cap, near misses grant extra shards',
    rarity: 'rare'
  },
  {
    id: 'lumen_relay',
    name: 'Lumen Relay',
    desc: 'Near misses ignite a lumen lane that boosts shards and adrenaline',
    rarity: 'rare'
  },
  {
    id: 'prism_echo',
    name: 'Prism Echo',
    desc: 'Every 5th food spawns an echo tail that grants bonus points',
    rarity: 'common'
  },
  {
    id: 'kaleidosurge_wake',
    name: 'Kaleidosurge Wake',
    desc: 'Food during surge extends surge and gains extra score',
    rarity: 'rare'
  },
  {
    id: 'overdrive_resonator',
    name: 'Overdrive Resonator',
    desc: 'Food during overdrive extends it; exit pulses bonus shards',
    rarity: 'rare'
  },
  {
    id: 'vector_flux',
    name: 'Vector Flux',
    desc: 'Precision turns grant adrenaline and reduce surge cooldown',
    rarity: 'common'
  },
  {
    id: 'magnet_bloom',
    name: 'Magnet Bloom',
    desc: 'Combo milestones trigger a short magnet bloom aura',
    rarity: 'common'
  },
  {
    id: 'gatecrash_bloom',
    name: 'Gatecrash Bloom',
    desc: 'Gate rewards bloom into bonus shards and points',
    rarity: 'common'
  },
  {
    id: 'prism_coil',
    name: 'Prism Coil',
    desc: 'Every 9th pickup triggers a prism coil for bonus pickups',
    rarity: 'rare'
  },
  {
    id: 'chromatic_aegis',
    name: 'Chromatic Aegis',
    desc: 'Every 40 shards grants a shield that negates a hit',
    rarity: 'rare'
  },
  {
    id: 'photon_weave',
    name: 'Photon Weave',
    desc: 'Survive to build weave stacks; surge/overdrive consumes for score',
    rarity: 'common'
  },
  {
    id: 'spectrum_signatures',
    name: 'Spectrum Signatures',
    desc: 'Augments gain distinct spectral visuals and signatures',
    rarity: 'rare'
  }
];

export const AUGMENT_COLORS: AugmentColorMap = {
  overclock: '#2bb3b1',
  ion_prism: '#5b8dbb',
  combo_weave: '#f08a4b',
  magnetic_bloom: '#6bbf6a',
  gate_bounty: '#f2b35d',
  surge_vector: '#f08a4b',
  ghost_mesh: '#7c8aa0',
  volatile_alchemy: '#c73a2f',
  pulse_harvest: '#3fa79a',
  hazard_forge: '#d45f5d',
  lumen_relay: '#73d8d3',
  prism_echo: '#e28d6e',
  kaleidosurge_wake: '#f2b35d',
  overdrive_resonator: '#2bb3b1',
  vector_flux: '#1f7f7a',
  magnet_bloom: '#6bbf6a',
  gatecrash_bloom: '#f2b35d',
  prism_coil: '#5b8dbb',
  chromatic_aegis: '#9bb5c6',
  photon_weave: '#f1c284',
  spectrum_signatures: '#fff4e6'
};

if (typeof window !== 'undefined') {
  const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
  NS.CONFIG = CONFIG;
  NS.QUALITY_TIERS = QUALITY_TIERS;
  NS.MODE_DEFS = MODE_DEFS;
  NS.POWERUP_TYPES = POWERUP_TYPES;
  NS.FOOD_TYPES = FOOD_TYPES;
  NS.SKINS = SKINS;
  NS.UPGRADES = UPGRADES;
  NS.AUGMENTS = AUGMENTS;
  NS.AUGMENT_COLORS = AUGMENT_COLORS;
}
