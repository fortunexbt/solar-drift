import { randRange } from './utils';
import type { LegacyNeonSnake } from './types';

declare global {
  interface Window {
    NeonSnake?: Partial<LegacyNeonSnake>;
  }
}

type MusicSourceEntry = {
  sources: OscillatorNode[];
  gain: GainNode;
  track: string;
};

type ProceduralTrack = {
  frequencies: number[];
  waveforms: OscillatorType[];
  levels: number[];
};

type MusicFxNodes = {
  filter: BiquadFilterNode;
  drive: WaveShaperNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  pan: StereoPannerNode;
  cleanGain: GainNode;
  fxGain: GainNode;
  tremoloDepth: GainNode;
  filterLfoGain: GainNode;
  panLfoGain: GainNode;
};

type MusicMixFactors = {
  speed?: number;
  combo?: number;
  hazards?: number;
  overdrive?: number;
};

type AugmentFlags = Record<string, boolean>;
type AugmentState = {
  lumenActiveMs: number;
  prismEchoActiveMs: number;
  magnetBloomActiveMs: number;
  prismCoilActiveMs: number;
};

type RuntimeState = {
  combo?: number;
  surgeActive?: boolean;
  overdriveActive?: boolean;
};

type HazardLike = {
  position: { x: number; y: number };
  isActive(): boolean;
};

type SpatialState = {
  snakeHead: { x: number; y: number };
  hazards: HazardLike[];
};

type ToneOptions = {
  type?: OscillatorType;
  frequency?: number;
  duration?: number;
  gain?: number;
  filterType?: BiquadFilterType | null;
  filterFreq?: number;
  target?: 'sfx' | 'ui';
};

export class SoundManager {
  audioContext: AudioContext | null;
  audioUnlocked: boolean;
  enabled: boolean;
  masterGain: GainNode | null;
  musicGain: GainNode | null;
  musicDucker: GainNode | null;
  sfxGain: GainNode | null;
  uiGain: GainNode | null;
  compressor: DynamicsCompressorNode | null;
  musicBus: GainNode | null;
  musicFilter: BiquadFilterNode | null;
  noiseBuffer: AudioBuffer | null;
  musicActive: boolean;
  musicRequested: boolean;
  musicSources: MusicSourceEntry[];
  musicScene: 'menu' | 'game';
  menuTrack: string;
  gameTracks: string[];
  gameTrackIndex: number;
  proceduralTracks: Record<string, ProceduralTrack>;
  pauseDucking: boolean;
  pauseDuckingLevel: number;
  musicFxInput: GainNode | null;
  musicFxOutput: GainNode | null;
  musicFxNodes: MusicFxNodes | null;
  musicFxLfos: OscillatorNode[];
  lastDriveAmount: number;
  lastUiSound: number;
  spatialEnabled: boolean;
  lastHazardPingMs: number;
  musicCleanGain: GainNode | null;
  musicFxGain: GainNode | null;
  musicDrive: WaveShaperNode | null;
  musicDelay: DelayNode | null;
  musicDelayFeedback: GainNode | null;
  musicPan: StereoPannerNode | null;
  musicTremoloGain: GainNode | null;
  musicFilterLfo: OscillatorNode | null;
  musicFilterLfoGain: GainNode | null;
  musicPanLfo: OscillatorNode | null;
  musicPanLfoGain: GainNode | null;
  musicTremoloLfo: OscillatorNode | null;
  musicTremoloDepth: GainNode | null;

  constructor() {
    this.audioContext = null;
    this.audioUnlocked = false;
    this.enabled = true;
    this.masterGain = null;
    this.musicGain = null;
    this.musicDucker = null;
    this.sfxGain = null;
    this.uiGain = null;
    this.compressor = null;
    this.musicBus = null;
    this.musicFilter = null;
    this.noiseBuffer = null;
    this.musicActive = false;
    this.musicRequested = false;
    this.musicSources = [];
    this.musicScene = 'menu';
    this.menuTrack = 'menu';
    this.gameTracks = ['drift-a', 'drift-b', 'drift-c'];
    this.gameTrackIndex = 0;
    // All music is synthesized at runtime. No bundled recordings or samples.
    this.proceduralTracks = {
      menu: {
        frequencies: [55, 110, 164.81, 220],
        waveforms: ['sine', 'triangle', 'sine', 'sine'],
        levels: [0.34, 0.2, 0.1, 0.06]
      },
      'drift-a': {
        frequencies: [55, 110, 138.59, 164.81],
        waveforms: ['triangle', 'sine', 'sine', 'triangle'],
        levels: [0.32, 0.17, 0.1, 0.07]
      },
      'drift-b': {
        frequencies: [61.74, 123.47, 146.83, 185],
        waveforms: ['triangle', 'sine', 'triangle', 'sine'],
        levels: [0.3, 0.17, 0.09, 0.07]
      },
      'drift-c': {
        frequencies: [65.41, 98, 130.81, 196],
        waveforms: ['triangle', 'sine', 'sine', 'triangle'],
        levels: [0.3, 0.16, 0.1, 0.06]
      }
    };
    this.pauseDucking = false;
    this.pauseDuckingLevel = 1.0;
    this.musicFxInput = null;
    this.musicFxOutput = null;
    this.musicFxNodes = null;
    this.musicFxLfos = [];
    this.lastDriveAmount = 0.2;
    this.lastUiSound = 0;
    this.spatialEnabled = false;
    this.lastHazardPingMs = 0;
    this.musicCleanGain = null;
    this.musicFxGain = null;
    this.musicDrive = null;
    this.musicDelay = null;
    this.musicDelayFeedback = null;
    this.musicPan = null;
    this.musicTremoloGain = null;
    this.musicFilterLfo = null;
    this.musicFilterLfoGain = null;
    this.musicPanLfo = null;
    this.musicPanLfoGain = null;
    this.musicTremoloLfo = null;
    this.musicTremoloDepth = null;
  }

  init(): void {
    if (!this.audioUnlocked) return;
    if (!this.audioContext) {
      const WebkitAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const AudioContextCtor = window.AudioContext || WebkitAudioContext;
      if (AudioContextCtor) {
        this.audioContext = new AudioContextCtor();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (!this.masterGain) {
      this.setupMix();
    }
  }

  unlock(): void {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this.init();
    if (!this.enabled || !this.musicRequested || this.musicActive) return;
    const track = this.musicScene === 'menu'
      ? this.menuTrack
      : this.gameTracks[this.gameTrackIndex % this.gameTracks.length];
    this.crossfadeTo(track, 0.35);
  }

  setupMix(): void {
    const ctx = this.audioContext;
    if (!ctx) return;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.enabled ? 0.85 : 0;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 20;
    this.compressor.ratio.value = 3.2;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.2;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.16;

    this.musicDucker = ctx.createGain();
    this.musicDucker.gain.value = 1.0;

    this.musicBus = ctx.createGain();

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.55;

    this.uiGain = ctx.createGain();
    this.uiGain.gain.value = 0.35;

    this.musicGain.connect(this.musicDucker);
    this.musicDucker.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.uiGain.connect(this.masterGain);
    this.masterGain.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    this.noiseBuffer = this.createNoiseBuffer();
    this.setupMusicFx();
  }

  createNoiseBuffer(): AudioBuffer | null {
    const ctx = this.audioContext;
    if (!ctx) return null;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * fade;
    }
    return buffer;
  }

  createDriveCurve(amount = 0.2): Float32Array<ArrayBuffer> {
    const k = Math.max(0, Math.min(1, amount)) * 40 + 1;
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  setupMusicFx(): void {
    const ctx = this.audioContext;
    if (!ctx || !this.musicBus) return;

    this.musicFxInput = ctx.createGain();
    this.musicFxOutput = ctx.createGain();
    this.musicCleanGain = ctx.createGain();
    this.musicFxGain = ctx.createGain();
    this.musicCleanGain.gain.value = 0.8;
    this.musicFxGain.gain.value = 0.2;

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1400;
    this.musicFilter.Q.value = 0.7;

    this.musicDrive = ctx.createWaveShaper();
    this.musicDrive.curve = this.createDriveCurve(0.2);
    this.musicDrive.oversample = '2x';

    this.musicDelay = ctx.createDelay(1.2);
    this.musicDelay.delayTime.value = 0.16;
    this.musicDelayFeedback = ctx.createGain();
    this.musicDelayFeedback.gain.value = 0.18;

    this.musicPan = ctx.createStereoPanner();
    this.musicPan.pan.value = 0;

    this.musicTremoloGain = ctx.createGain();
    this.musicTremoloGain.gain.value = 1;

    this.musicBus.connect(this.musicFxInput);
    this.musicFxInput.connect(this.musicCleanGain);
    this.musicCleanGain.connect(this.musicFxOutput);

    this.musicFxInput.connect(this.musicFilter);
    this.musicFilter.connect(this.musicDrive);
    this.musicDrive.connect(this.musicDelay);
    this.musicDelay.connect(this.musicPan);
    this.musicPan.connect(this.musicTremoloGain);
    this.musicTremoloGain.connect(this.musicFxGain);
    this.musicFxGain.connect(this.musicFxOutput);

    this.musicDelay.connect(this.musicDelayFeedback);
    this.musicDelayFeedback.connect(this.musicDelay);

    this.musicFxOutput.connect(this.musicGain!);

    this.musicFilterLfo = ctx.createOscillator();
    this.musicFilterLfo.frequency.value = 0.08;
    this.musicFilterLfoGain = ctx.createGain();
    this.musicFilterLfoGain.gain.value = 80;
    this.musicFilterLfo.connect(this.musicFilterLfoGain);
    this.musicFilterLfoGain.connect(this.musicFilter.frequency);

    this.musicPanLfo = ctx.createOscillator();
    this.musicPanLfo.frequency.value = 0.05;
    this.musicPanLfoGain = ctx.createGain();
    this.musicPanLfoGain.gain.value = 0.05;
    this.musicPanLfo.connect(this.musicPanLfoGain);
    this.musicPanLfoGain.connect(this.musicPan.pan);

    this.musicTremoloLfo = ctx.createOscillator();
    this.musicTremoloLfo.frequency.value = 2.4;
    this.musicTremoloDepth = ctx.createGain();
    this.musicTremoloDepth.gain.value = 0;
    this.musicTremoloLfo.connect(this.musicTremoloDepth);
    this.musicTremoloDepth.connect(this.musicTremoloGain.gain);

    this.musicFilterLfo.start();
    this.musicPanLfo.start();
    this.musicTremoloLfo.start();

    this.musicFxNodes = {
      filter: this.musicFilter,
      drive: this.musicDrive,
      delay: this.musicDelay,
      delayFeedback: this.musicDelayFeedback,
      pan: this.musicPan,
      cleanGain: this.musicCleanGain,
      fxGain: this.musicFxGain,
      tremoloDepth: this.musicTremoloDepth,
      filterLfoGain: this.musicFilterLfoGain,
      panLfoGain: this.musicPanLfoGain
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.init();
    }
    if (!this.audioContext || !this.masterGain) return;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(enabled ? 0.85 : 0, now + 0.12);
    if (!enabled) {
      this.stopMusic(false);
    } else if (this.musicRequested && !this.musicActive) {
      if (this.musicScene === 'menu') {
        this.playMenuMusic();
      } else {
        this.playGameMusic();
      }
    }
  }

  startMusic(): void {
    this.playGameMusic();
  }

  playMenuMusic(): void {
    this.musicRequested = true;
    this.musicScene = 'menu';
    if (!this.enabled) return;
    this.init();
    this.crossfadeTo(this.menuTrack, 0.8);
  }

  playGameMusic(): void {
    this.musicRequested = true;
    this.musicScene = 'game';
    if (!this.enabled) return;
    this.init();
    const track = this.gameTracks[this.gameTrackIndex % this.gameTracks.length];
    this.gameTrackIndex = (this.gameTrackIndex + 1) % this.gameTracks.length;
    this.crossfadeTo(track, 0.8);
  }

  crossfadeTo(track: string, fadeSeconds = 0.8): void {
    if (!this.audioContext || !this.musicBus) return;
    const pattern = this.proceduralTracks[track];
    if (!pattern) return;
    if (this.musicSources.length && this.musicSources[0].track === track) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const sceneGain = ctx.createGain();
    sceneGain.gain.setValueAtTime(0.0001, now);
    sceneGain.connect(this.musicBus);

    const sources = pattern.frequencies.map((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const voiceGain = ctx.createGain();
      oscillator.type = pattern.waveforms[index] || 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.detune.setValueAtTime(index % 2 === 0 ? -3 : 3, now);
      voiceGain.gain.setValueAtTime(pattern.levels[index] || 0.06, now);
      oscillator.connect(voiceGain);
      voiceGain.connect(sceneGain);
      oscillator.start(now + 0.02);
      return oscillator;
    });

    sceneGain.gain.exponentialRampToValueAtTime(1, now + fadeSeconds);
    if (this.musicTremoloDepth) {
      this.musicTremoloDepth.gain.setTargetAtTime(track === 'menu' ? 0.025 : 0.055, now, 0.2);
    }

    this.musicSources.forEach(({ sources: oldSources, gain: oldGain }) => {
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
      oldGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
      oldSources.forEach(source => source.stop(now + fadeSeconds + 0.05));
    });

    this.musicSources = [{ sources, gain: sceneGain, track }];
    this.musicActive = true;
  }

  stopMusic(clearRequest = true): void {
    if (clearRequest) this.musicRequested = false;
    if (!this.musicActive) return;
    this.musicActive = false;
    const now = this.audioContext ? this.audioContext.currentTime : 0;
    this.musicSources.forEach(({ sources, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        sources.forEach(source => source.stop(now + 0.35));
      } catch (error) {
        return;
      }
    });
    this.musicSources = [];
  }

  updateMusicMix(intensity: number, factors: MusicMixFactors = {}, augmentFlags: AugmentFlags | null = null, augmentState: AugmentState | null = null, runtime: RuntimeState | null = null): void {
    if (!this.musicActive || !this.audioContext || !this.musicGain) return;
    const now = this.audioContext.currentTime;
    const target = Math.max(0.1, Math.min(0.22, 0.1 + intensity * 0.14));
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(target, now + 0.18);

    const { speed = 0, combo = 0, hazards = 0, overdrive = 0 } = factors;
    if (this.musicFxNodes) {
      const clean = 0.78 - intensity * 0.12;
      const fx = 0.22 + intensity * 0.18;
      this.musicFxNodes.cleanGain.gain.linearRampToValueAtTime(clean, now + 0.2);
      this.musicFxNodes.fxGain.gain.linearRampToValueAtTime(fx, now + 0.2);
    }

    if (this.musicFilter) {
      const freq = 950 + intensity * 950 + overdrive * 400 - hazards * 120;
      this.musicFilter.frequency.cancelScheduledValues(now);
      this.musicFilter.frequency.linearRampToValueAtTime(freq, now + 0.2);
      this.musicFilter.Q.cancelScheduledValues(now);
      this.musicFilter.Q.linearRampToValueAtTime(0.7 + combo * 0.4, now + 0.2);
    }

    if (augmentFlags && augmentState) {
      this.updateAugmentFx(augmentFlags, augmentState, runtime || {}, intensity, factors);
    }
  }

  updateAugmentFx(augmentFlags: AugmentFlags, augmentState: AugmentState, runtime: RuntimeState, intensity: number, factors: MusicMixFactors): void {
    if (!this.musicFxNodes || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const combo = runtime.combo || 0;
    const surge = runtime.surgeActive ? 1 : 0;
    const overdrive = runtime.overdriveActive ? 1 : 0;

    let filterLfo = 80 + intensity * 60;
    let panLfo = 0.05;
    let drive = 0.18 + intensity * 0.08;
    let delayMix = 0.2;
    let delayTime = 0.16;
    let feedback = 0.18;
    let tremoloDepth = 0;

    if (augmentFlags.overclock) {
      drive += 0.15;
      filterLfo += 50;
    }
    if (augmentFlags.ion_prism) {
      panLfo += 0.18;
      delayMix += 0.12;
      delayTime += 0.06;
    }
    if (augmentFlags.combo_weave) {
      tremoloDepth += Math.min(0.28, combo * 0.02);
    }
    if (augmentFlags.magnetic_bloom) {
      filterLfo += 90;
      delayMix += 0.05;
    }
    if (augmentFlags.gate_bounty) {
      delayMix += 0.08;
      feedback += 0.06;
    }
    if (augmentFlags.surge_vector) {
      filterLfo += surge * 120;
      panLfo += surge * 0.08;
    }
    if (augmentFlags.ghost_mesh) {
      delayTime += 0.04;
      panLfo += 0.08;
    }
    if (augmentFlags.volatile_alchemy) {
      drive += 0.2;
      feedback += 0.08;
    }
    if (augmentFlags.pulse_harvest) {
      delayMix += 0.1;
      tremoloDepth += 0.08;
    }
    if (augmentFlags.hazard_forge) {
      drive += 0.1;
      filterLfo += 40;
    }
    if (augmentFlags.lumen_relay && augmentState.lumenActiveMs > 0) {
      filterLfo += 120;
      delayMix += 0.1;
    }
    if (augmentFlags.prism_echo && augmentState.prismEchoActiveMs > 0) {
      delayMix += 0.2;
      delayTime += 0.08;
    }
    if (augmentFlags.kaleidosurge_wake && surge) {
      tremoloDepth += 0.2;
      panLfo += 0.12;
    }
    if (augmentFlags.overdrive_resonator && overdrive) {
      drive += 0.2;
      delayMix += 0.1;
    }
    if (augmentFlags.vector_flux) {
      filterLfo += 50;
      panLfo += 0.05;
    }
    if (augmentFlags.magnet_bloom && augmentState.magnetBloomActiveMs > 0) {
      filterLfo += 120;
      delayMix += 0.08;
    }
    if (augmentFlags.gatecrash_bloom) {
      delayTime += 0.05;
      feedback += 0.05;
    }
    if (augmentFlags.prism_coil && augmentState.prismCoilActiveMs > 0) {
      panLfo += 0.2;
      delayMix += 0.16;
    }
    if (augmentFlags.chromatic_aegis) {
      filterLfo += 30;
    }
    if (augmentFlags.photon_weave) {
      delayMix += 0.06;
      tremoloDepth += 0.1;
    }
    if (augmentFlags.spectrum_signatures) {
      panLfo += 0.1;
      filterLfo += 60;
    }

    drive = Math.min(0.85, drive);
    delayMix = Math.min(0.7, delayMix);
    feedback = Math.min(0.6, feedback);

    this.musicFxNodes.filterLfoGain.gain.setTargetAtTime(filterLfo, now, 0.18);
    this.musicFxNodes.panLfoGain.gain.setTargetAtTime(panLfo, now, 0.18);
    this.musicFxNodes.tremoloDepth.gain.setTargetAtTime(tremoloDepth, now, 0.2);
    this.musicFxNodes.delay.delayTime.setTargetAtTime(delayTime, now, 0.18);
    this.musicFxNodes.delayFeedback.gain.setTargetAtTime(feedback, now, 0.2);
    this.musicFxNodes.fxGain.gain.setTargetAtTime(delayMix, now, 0.2);
    this.musicFxNodes.cleanGain.gain.setTargetAtTime(1 - delayMix, now, 0.2);
    if (Math.abs(drive - this.lastDriveAmount) > 0.03) {
      this.musicFxNodes.drive.curve = this.createDriveCurve(drive);
      this.lastDriveAmount = drive;
    }
  }

  duckMusic(amount = 0.6, attack = 0.02, release = 0.3): void {
    if (!this.musicDucker || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const base = this.pauseDuckingLevel;
    this.musicDucker.gain.cancelScheduledValues(now);
    this.musicDucker.gain.setValueAtTime(this.musicDucker.gain.value, now);
    this.musicDucker.gain.linearRampToValueAtTime(amount, now + attack);
    this.musicDucker.gain.linearRampToValueAtTime(base, now + attack + release);
  }

  setPauseDucking(isPaused: boolean): void {
    if (!this.musicDucker || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const target = isPaused ? 0.35 : 1.0;
    this.pauseDucking = isPaused;
    this.pauseDuckingLevel = target;
    this.musicDucker.gain.cancelScheduledValues(now);
    this.musicDucker.gain.setValueAtTime(this.musicDucker.gain.value, now);
    this.musicDucker.gain.linearRampToValueAtTime(target, now + 0.25);
  }

  playTone({ type = 'sine', frequency = 660, duration = 0.12, gain = 0.2, filterType = null, filterFreq = 600, target = 'sfx' }: ToneOptions = {}): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    if (filterType) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      oscillator.connect(filter);
      filter.connect(gainNode);
    } else {
      oscillator.connect(gainNode);
    }

    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    gainNode.connect(target === 'ui' ? this.uiGain! : this.sfxGain!);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  playEat(): void {
    this.duckMusic(0.8, 0.01, 0.12);
    this.playTone({ type: 'sine', frequency: 880 + randRange(-20, 20), duration: 0.1, gain: 0.18, filterType: 'highpass', filterFreq: 240 });
  }

  playBonus(): void {
    this.duckMusic(0.7, 0.01, 0.18);
    this.playTone({ type: 'triangle', frequency: 720 + randRange(-30, 30), duration: 0.14, gain: 0.2, filterType: 'bandpass', filterFreq: 640 });
  }

  playSuper(): void {
    this.duckMusic(0.55, 0.01, 0.28);
    [523.25, 659.25, 783.99].forEach((freq) => {
      this.playTone({ type: 'sine', frequency: freq, duration: 0.2, gain: 0.13, target: 'sfx' });
    });
  }

  playDie(): void {
    this.duckMusic(0.4, 0.01, 0.5);
    this.playTone({ type: 'sawtooth', frequency: 200, duration: 0.5, gain: 0.22, filterType: 'lowpass', filterFreq: 520 });
  }

  playPowerUp(powerUpType: string): void {
    this.duckMusic(0.6, 0.01, 0.3);
    const freqMap: Record<string, number> = {
      SPEED: 880,
      GHOST: 440,
      '2X': 660,
      MAG: 330
    };
    this.playTone({ type: 'square', frequency: freqMap[powerUpType] || 660, duration: 0.2, gain: 0.16 });
  }

  playUi(type = 'select'): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    if (now - this.lastUiSound < 0.05) return;
    this.lastUiSound = now;
    this.playTone({
      type: 'triangle',
      frequency: type === 'confirm' ? 860 : 620,
      duration: 0.08,
      gain: 0.12,
      target: 'ui'
    });
  }

  playGateReward(): void {
    this.playTone({ type: 'sine', frequency: 920, duration: 0.12, gain: 0.14 });
  }

  playNearMiss(): void {
    this.playTone({ type: 'square', frequency: 500, duration: 0.08, gain: 0.09 });
  }

  playOverdriveStart(): void {
    this.duckMusic(0.6, 0.02, 0.4);
    this.playTone({ type: 'sawtooth', frequency: 440, duration: 0.3, gain: 0.16 });
  }

  playOverdriveEnd(): void {
    this.playTone({ type: 'triangle', frequency: 260, duration: 0.2, gain: 0.12 });
  }

  playSurge(): void {
    this.playTone({ type: 'square', frequency: 740, duration: 0.14, gain: 0.16 });
  }

  updateSpatialCues(state: SpatialState): void {
    if (!this.enabled || !this.audioContext || !this.spatialEnabled) return;
    const now = this.audioContext.currentTime;
    if (now - this.lastHazardPingMs > 1.2) {
      const head = state.snakeHead;
      let closestDist = Infinity;
      let closestHazard: HazardLike | null = null;
      for (const h of state.hazards) {
        if (h.isActive()) {
          const d = Math.sqrt(Math.pow(h.position.x - head.x, 2) + Math.pow(h.position.y - head.y, 2));
          if (d < closestDist) {
            closestDist = d;
            closestHazard = h;
          }
        }
      }
      if (closestDist < 6 && closestHazard) {
        this.playHazardPing(closestHazard.position, head);
        this.lastHazardPingMs = now;
      }
    }
  }

  playHazardPing(pos: { x: number; y: number }, listener: { x: number; y: number }): void {
    if (!this.audioContext || !this.sfxGain) return;
    const pan = Math.max(-1, Math.min(1, (pos.x - listener.x) / 10));
    const vol = Math.max(0.01, 0.08 * (1 - Math.min(6, Math.sqrt(Math.pow(pos.x - listener.x, 2) + Math.pow(pos.y - listener.y, 2))) / 6));
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const g = this.audioContext.createGain();
    const panner = this.audioContext.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    panner.pan.setValueAtTime(pan, now);
    osc.connect(g);
    g.connect(panner);
    panner.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

if (typeof window !== 'undefined') {
  const NS = (window.NeonSnake ??= {}) as Partial<LegacyNeonSnake>;
  NS.SoundManager = SoundManager;
}
