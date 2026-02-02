// Sound Manager using Web Audio API
// Generates synthesized sounds without external audio files

type SoundType =
  | 'reveal'
  | 'revealChain'
  | 'explosion'
  | 'flag'
  | 'unflag'
  | 'item'
  | 'achievement'
  | 'chat'
  | 'error'
  | 'skill';

// Cooldown settings per sound type (in ms)
const SOUND_COOLDOWNS: Record<SoundType, number> = {
  reveal: 50,        // Fast sounds need short cooldown
  revealChain: 100,  // Chain reveals happen in bursts
  explosion: 200,    // Explosions are dramatic, longer cooldown
  flag: 80,
  unflag: 80,
  item: 150,
  achievement: 500,  // Achievements are rare, can overlap
  chat: 100,
  error: 200,
  skill: 150,
};

// Maximum concurrent sounds before volume reduction kicks in
const MAX_CONCURRENT_SOUNDS = 3;
const VOLUME_REDUCTION_FACTOR = 0.6; // Reduce to 60% when too many sounds

class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  // Track last play time for each sound type (for cooldown)
  private lastPlayTime: Map<SoundType, number> = new Map();

  // Track currently active sounds (for volume management)
  private activeSounds: number = 0;
  private activeSoundDecayTimeout: NodeJS.Timeout | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get effective volume considering concurrent sounds
   */
  private getEffectiveVolume(): number {
    if (this.activeSounds >= MAX_CONCURRENT_SOUNDS) {
      return this.volume * VOLUME_REDUCTION_FACTOR;
    }
    return this.volume;
  }

  /**
   * Check if sound can be played (cooldown check)
   */
  private canPlay(sound: SoundType): boolean {
    const now = Date.now();
    const lastPlay = this.lastPlayTime.get(sound) || 0;
    const cooldown = SOUND_COOLDOWNS[sound];

    if (now - lastPlay < cooldown) {
      return false;
    }

    this.lastPlayTime.set(sound, now);
    return true;
  }

  /**
   * Track active sound and schedule decay
   */
  private trackSound(duration: number): void {
    this.activeSounds++;

    // Schedule decay
    setTimeout(() => {
      this.activeSounds = Math.max(0, this.activeSounds - 1);
    }, duration);
  }

  play(sound: SoundType): void {
    if (!this.enabled || this.volume === 0) return;

    // Check cooldown
    if (!this.canPlay(sound)) return;

    try {
      switch (sound) {
        case 'reveal':
          this.playReveal();
          break;
        case 'revealChain':
          this.playRevealChain();
          break;
        case 'explosion':
          this.playExplosion();
          break;
        case 'flag':
          this.playFlag();
          break;
        case 'unflag':
          this.playUnflag();
          break;
        case 'item':
          this.playItem();
          break;
        case 'achievement':
          this.playAchievement();
          break;
        case 'chat':
          this.playChat();
          break;
        case 'error':
          this.playError();
          break;
        case 'skill':
          this.playSkill();
          break;
      }
    } catch (e) {
      console.warn('Sound playback failed:', e);
    }
  }

  // Simple click/pop for cell reveal
  private playReveal(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = this.getEffectiveVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);

    this.trackSound(50);
  }

  // Cascade sound for chain reveals
  private playRevealChain(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = this.getEffectiveVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(vol * 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    this.trackSound(150);
  }

  // Explosion sound for mines
  private playExplosion(): void {
    const ctx = this.getContext();
    const vol = this.getEffectiveVolume();

    // Noise burst
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(ctx.currentTime);

    // Low frequency thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);

    oscGain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);

    this.trackSound(300);
  }

  // Flag placement sound
  private playFlag(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = this.getEffectiveVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.05); // E5

    gain.gain.setValueAtTime(vol * 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);

    this.trackSound(100);
  }

  // Unflag sound
  private playUnflag(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = this.getEffectiveVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(523, ctx.currentTime + 0.05); // C5

    gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);

    this.trackSound(100);
  }

  // Item pickup sound
  private playItem(): void {
    const ctx = this.getContext();
    const vol = this.getEffectiveVolume();

    const frequencies = [523, 659, 784]; // C5, E5, G5

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      const startTime = ctx.currentTime + i * 0.05;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(vol * 0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });

    this.trackSound(250);
  }

  // Achievement unlock fanfare
  private playAchievement(): void {
    const ctx = this.getContext();
    const vol = this.getEffectiveVolume();

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      const startTime = ctx.currentTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(vol * 0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });

    this.trackSound(700);
  }

  // Chat notification
  private playChat(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = this.getEffectiveVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(vol * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);

    this.trackSound(80);
  }

  // Error sound
  private playError(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = this.getEffectiveVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.setValueAtTime(150, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);

    this.trackSound(200);
  }

  // Skill activation
  private playSkill(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const vol = this.getEffectiveVolume();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(vol * 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    this.trackSound(150);
  }
}

// Singleton instance
export const soundManager = new SoundManager();
