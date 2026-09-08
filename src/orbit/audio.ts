type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

interface Voice {
  oscillators: OscillatorNode[];
  partialGains: GainNode[];
  gain: GainNode;
}

const MAX_VOICES = 12;
const CAPTURE_NOTES = [587.33, 739.99, 880, 1174.66, 1479.98];

/** Quiet, synthesized sound. Only unlock(), called by a gesture, creates audio. */
export class OrbitAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private motionGain: GainNode | null = null;
  private motionFilter: BiquadFilterNode | null = null;
  private motionOscillators: OscillatorNode[] = [];
  private nodes: AudioNode[] = [];
  private voices = new Set<Voice>();
  private muted = false;
  private playing = false;
  private disposed = false;
  private speed = 0;
  private boosting = false;
  private lastMotionUpdate = -Infinity;
  private lastNearMiss = -Infinity;
  private lastHit = -Infinity;
  private lastCapture = -Infinity;

  async unlock(): Promise<void> {
    if (this.disposed || typeof window === 'undefined') return;

    try {
      if (!this.context) {
        const audioWindow = window as Window & {
          webkitAudioContext?: AudioContextConstructor;
        };
        const Context: AudioContextConstructor | undefined =
          window.AudioContext ?? audioWindow.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.createGraph(this.context);
      }

      if (this.context.state === 'suspended') await this.context.resume();
      if (this.disposed) return;
      this.applyMute();
      this.updateMotion(true);
    } catch {
      // Autoplay denial and unavailable devices must never interrupt play.
      // A later gesture can retry resume on an otherwise valid context.
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMute();
  }

  setMotion(speedRatio: number, boost: boolean): void {
    this.speed = Number.isFinite(speedRatio) ? Math.max(0, Math.min(1, speedRatio)) : 0;
    this.boosting = boost;
    this.updateMotion();
  }

  capture(count: number, combo: number): void {
    const context = this.audibleContext();
    if (!context || !Number.isFinite(count) || count <= 0) return;
    // Coalesce same-frame events into a chord-sized response, not a wall of notes.
    if (context.currentTime - this.lastCapture < 0.045) return;
    this.lastCapture = context.currentTime;
    const notes = Math.min(5, Math.ceil(count));
    const safeCombo = Number.isFinite(combo) ? Math.max(0, combo) : 0;
    const offset = Math.min(2, Math.floor(safeCombo / 4));
    const level = 0.11 / Math.sqrt(notes);

    for (let index = 0; index < notes; index++) {
      const note = CAPTURE_NOTES[(index + offset) % CAPTURE_NOTES.length];
      this.tone(note, 0.65, level, index * 0.055, true);
    }
  }

  nearMiss(): void {
    const context = this.audibleContext();
    if (!context || context.currentTime - this.lastNearMiss < 0.5) return;
    this.lastNearMiss = context.currentTime;
    this.tone(440, 0.22, 0.045, 0, false, 660);
  }

  hit(): void {
    const context = this.audibleContext();
    if (!context || context.currentTime - this.lastHit < 0.2) return;
    this.lastHit = context.currentTime;
    this.tone(146.83, 0.3, 0.16, 0, false, 65.41);
    if (this.motionGain) {
      const now = context.currentTime;
      this.motionGain.gain.cancelScheduledValues(now);
      this.motionGain.gain.setTargetAtTime(0.005, now, 0.025);
      this.motionGain.gain.setTargetAtTime(this.motionLevel(), now + 0.16, 0.18);
    }
  }

  start(): void {
    if (this.disposed) return;
    const wasPlaying = this.playing;
    this.playing = true;
    this.lastNearMiss = -Infinity;
    this.lastHit = -Infinity;
    this.lastCapture = -Infinity;
    this.updateMotion(true);
    if (!wasPlaying) {
      this.tone(293.66, 0.75, 0.075, 0, true);
      this.tone(440, 0.8, 0.06, 0.12, true);
    }
  }

  end(): void {
    const wasPlaying = this.playing;
    this.playing = false;
    this.updateMotion(true);
    if (wasPlaying) {
      this.tone(293.66, 0.9, 0.075, 0, true);
      this.tone(220, 1.1, 0.055, 0.16, true);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playing = false;
    for (const voice of this.voices) this.stopVoice(voice);
    for (const oscillator of this.motionOscillators) {
      oscillator.stop();
      oscillator.disconnect();
    }
    for (const node of this.nodes) node.disconnect();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.motionGain = null;
    this.motionFilter = null;
    this.motionOscillators = [];
    this.nodes = [];
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private createGraph(context: AudioContext): void {
    const master = context.createGain();
    master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 15;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.2;
    master.connect(compressor);
    compressor.connect(context.destination);
    this.master = master;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 230;
    filter.Q.value = 0.45;
    const motionGain = context.createGain();
    motionGain.gain.value = 0;
    filter.connect(motionGain);
    motionGain.connect(master);
    this.motionFilter = filter;
    this.motionGain = motionGain;
    this.nodes.push(master, compressor, filter, motionGain);

    // An open fifth, slightly detuned: continuous and warm, never retriggered by RAF.
    [73.416, 110].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 0 ? -3 : 3;
      const level = context.createGain();
      level.gain.value = index === 0 ? 0.7 : 0.26;
      oscillator.connect(level);
      level.connect(filter);
      oscillator.start();
      this.motionOscillators.push(oscillator);
      this.nodes.push(level);
    });
  }

  private applyMute(): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.52, now, 0.025);
  }

  private motionLevel(): number {
    return this.playing ? 0.024 + this.speed * 0.025 + (this.boosting ? 0.01 : 0) : 0;
  }

  private updateMotion(force = false): void {
    const context = this.context;
    if (!context || !this.motionGain || !this.motionFilter || context.state !== 'running') return;
    const now = context.currentTime;
    if (!force && now - this.lastMotionUpdate < 1 / 30) return;
    this.lastMotionUpdate = now;
    this.motionGain.gain.cancelScheduledValues(now);
    this.motionGain.gain.setTargetAtTime(this.motionLevel(), now, this.playing ? 0.2 : 0.4);
    this.motionFilter.frequency.cancelScheduledValues(now);
    this.motionFilter.frequency.setTargetAtTime(230 + this.speed * 180 + (this.boosting ? 500 : 0), now, 0.18);
    this.motionOscillators.forEach((oscillator, index) => {
      oscillator.detune.cancelScheduledValues(now);
      oscillator.detune.setTargetAtTime((index === 0 ? -3 : 3) + this.speed * 7 + (this.boosting ? 9 : 0), now, 0.2);
    });
  }

  private audibleContext(): AudioContext | null {
    return !this.disposed && !this.muted && this.context?.state === 'running' ? this.context : null;
  }

  private tone(frequency: number, duration: number, level: number, delay = 0, glass = false, endFrequency?: number): void {
    const context = this.audibleContext();
    if (!context || !this.master) return;
    // Preserve ringing tails at the cap; skipping a note avoids both clicks and
    // a hidden queue of fading voices during an unusually dense burst.
    if (this.voices.size >= MAX_VOICES) return;

    const when = context.currentTime + delay;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    gain.gain.linearRampToValueAtTime(0, when + duration + 0.03);
    gain.connect(this.master);
    const voice: Voice = { oscillators: [], partialGains: [], gain };
    this.voices.add(voice);

    // The faint inharmonic partial gives a glass edge without a sharp attack.
    const partials = glass ? [1, 2.003] : [1];
    for (const partial of partials) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency * partial, when);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency * partial, when + duration);
      const partialGain = context.createGain();
      partialGain.gain.value = partial === 1 ? 1 : 0.15;
      oscillator.connect(partialGain);
      partialGain.connect(gain);
      voice.partialGains.push(partialGain);
      oscillator.onended = () => {
        oscillator.disconnect();
        partialGain.disconnect();
        const index = voice.oscillators.indexOf(oscillator);
        if (index >= 0) voice.oscillators.splice(index, 1);
        if (voice.oscillators.length === 0) {
          gain.disconnect();
          this.voices.delete(voice);
        }
      };
      voice.oscillators.push(oscillator);
      oscillator.start(when);
      oscillator.stop(when + duration + 0.04);
    }
  }

  private stopVoice(voice: Voice): void {
    for (const oscillator of voice.oscillators) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
    }
    for (const gain of voice.partialGains) gain.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }
}
