// Ambient/New Age Music Generator using Web Audio API
// Creates procedural background music without external files

class MusicManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private volume: number = 0.5;
  private enabled: boolean = true;

  // Active nodes for cleanup
  private activeOscillators: OscillatorNode[] = [];
  private activeGains: GainNode[] = [];
  private intervals: NodeJS.Timeout[] = [];

  // Musical scales (pentatonic for pleasant sound)
  private scale = [0, 2, 4, 7, 9]; // C pentatonic: C, D, E, G, A
  private baseNote = 48; // C3 MIDI note

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private getRandomNote(octaveOffset: number = 0): number {
    const scaleIndex = Math.floor(Math.random() * this.scale.length);
    return this.baseNote + this.scale[scaleIndex] + (octaveOffset * 12);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume * 0.3, this.getContext().currentTime);
    }
  }

  start(): void {
    if (this.isPlaying || !this.enabled) return;

    const ctx = this.getContext();

    // Master gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(this.volume * 0.3, ctx.currentTime + 2);
    this.masterGain.connect(ctx.destination);

    this.isPlaying = true;

    // Start ambient layers
    this.startPadLayer();
    this.startArpeggioLayer();
    this.startTextureLayer();
  }

  stop(): void {
    if (!this.isPlaying) return;

    const ctx = this.getContext();

    // Fade out
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    }

    // Clear intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];

    // Stop oscillators after fade
    setTimeout(() => {
      this.activeOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      this.activeGains.forEach((gain) => {
        try {
          gain.disconnect();
        } catch (e) {}
      });

      this.activeOscillators = [];
      this.activeGains = [];

      if (this.masterGain) {
        this.masterGain.disconnect();
        this.masterGain = null;
      }
    }, 1500);

    this.isPlaying = false;
  }

  // Warm pad layer - slow evolving chords
  private startPadLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const playPadChord = () => {
      if (!this.isPlaying || !this.masterGain) return;

      // Pick 3 notes for a chord
      const root = this.getRandomNote(0);
      const notes = [root, root + this.scale[2], root + this.scale[4]];

      notes.forEach((note, i) => {
        const freq = this.midiToFreq(note);

        // Multiple detuned oscillators for warmth
        for (let d = -1; d <= 1; d++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq + d * 0.5, ctx.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, ctx.currentTime);
          filter.Q.setValueAtTime(1, ctx.currentTime);

          // Slow attack and release
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2);
          gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 6);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 10);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain!);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 10);

          this.activeOscillators.push(osc);
          this.activeGains.push(gain);
        }
      });
    };

    playPadChord();
    const interval = setInterval(playPadChord, 8000);
    this.intervals.push(interval);
  }

  // Gentle arpeggio layer
  private startArpeggioLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const playArpNote = () => {
      if (!this.isPlaying || !this.masterGain) return;

      const note = this.getRandomNote(1);
      const freq = this.midiToFreq(note);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 3);

      this.activeOscillators.push(osc);
      this.activeGains.push(gain);
    };

    // Random intervals between notes
    const scheduleNext = () => {
      if (!this.isPlaying) return;
      playArpNote();
      const nextDelay = 500 + Math.random() * 1500;
      const timeout = setTimeout(scheduleNext, nextDelay);
      this.intervals.push(timeout as unknown as NodeJS.Timeout);
    };

    setTimeout(scheduleNext, 2000);
  }

  // Soft ambient texture
  private startTextureLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const playTexture = () => {
      if (!this.isPlaying || !this.masterGain) return;

      const note = this.getRandomNote(2);
      const freq = this.midiToFreq(note);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(500, ctx.currentTime + 5);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 5);

      this.activeOscillators.push(osc);
      this.activeGains.push(gain);
    };

    const scheduleNext = () => {
      if (!this.isPlaying) return;
      playTexture();
      const nextDelay = 3000 + Math.random() * 4000;
      const timeout = setTimeout(scheduleNext, nextDelay);
      this.intervals.push(timeout as unknown as NodeJS.Timeout);
    };

    setTimeout(scheduleNext, 4000);
  }

  toggle(): void {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

// Singleton instance
export const musicManager = new MusicManager();
