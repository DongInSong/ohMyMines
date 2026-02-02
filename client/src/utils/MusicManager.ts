// Lo-fi Chill Music Generator using Web Audio API
// Creates procedural background music for a relaxed gaming atmosphere

class MusicManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private isPlaying: boolean = false;
  private volume: number = 0.5;
  private enabled: boolean = true;

  // Active nodes for cleanup
  private activeOscillators: OscillatorNode[] = [];
  private activeGains: GainNode[] = [];
  private activeBufferSources: AudioBufferSourceNode[] = [];
  private intervals: (NodeJS.Timeout | number)[] = [];

  // Musical configuration - C minor pentatonic with extensions
  private chordProgressions = [
    [48, 51, 55, 58], // Cm7
    [46, 50, 53, 58], // Bb maj7
    [53, 56, 60, 63], // Fm7
    [51, 55, 58, 63], // Eb maj7
  ];
  private currentChordIndex = 0;

  // Melodic scale (C minor pentatonic)
  private melodyNotes = [60, 63, 65, 67, 70, 72, 75, 77];

  // Tempo
  private bpm = 75;
  private beatDuration = 60 / this.bpm;

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

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.volume * 0.4,
        this.getContext().currentTime,
        0.1
      );
    }
  }

  start(): void {
    if (this.isPlaying || !this.enabled) return;

    const ctx = this.getContext();

    // Compressor for glue
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, ctx.currentTime);
    this.compressor.ratio.setValueAtTime(4, ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, ctx.currentTime);
    this.compressor.connect(ctx.destination);

    // Master gain with fade in
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(
      this.volume * 0.4,
      ctx.currentTime + 3
    );
    this.masterGain.connect(this.compressor);

    this.isPlaying = true;
    this.currentChordIndex = 0;

    // Start all layers
    this.startDroneLayer();
    this.startChordLayer();
    this.startBassLayer();
    this.startRhythmLayer();
    this.startMelodyLayer();
    this.startAtmosphereLayer();
  }

  stop(): void {
    if (!this.isPlaying) return;

    const ctx = this.getContext();

    // Fade out
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    }

    // Clear all intervals
    this.intervals.forEach((interval) => {
      if (typeof interval === 'number') {
        clearTimeout(interval);
        clearInterval(interval);
      } else {
        clearTimeout(interval);
        clearInterval(interval);
      }
    });
    this.intervals = [];

    // Cleanup after fade
    setTimeout(() => {
      this.activeOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      this.activeBufferSources.forEach((src) => {
        try {
          src.stop();
          src.disconnect();
        } catch (e) {}
      });
      this.activeGains.forEach((gain) => {
        try {
          gain.disconnect();
        } catch (e) {}
      });

      this.activeOscillators = [];
      this.activeBufferSources = [];
      this.activeGains = [];

      if (this.masterGain) {
        this.masterGain.disconnect();
        this.masterGain = null;
      }
      if (this.compressor) {
        this.compressor.disconnect();
        this.compressor = null;
      }
    }, 2500);

    this.isPlaying = false;
  }

  // Deep sub drone for warmth
  private startDroneLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const createDrone = () => {
      if (!this.isPlaying || !this.masterGain) return;

      const chord = this.chordProgressions[this.currentChordIndex];
      const rootFreq = this.midiToFreq(chord[0] - 24); // 2 octaves down

      // Sub oscillator
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(rootFreq, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 2);
      gain.gain.setValueAtTime(0.35, ctx.currentTime + this.beatDuration * 6);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + this.beatDuration * 8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + this.beatDuration * 8 + 0.5);

      this.activeOscillators.push(osc);
      this.activeGains.push(gain);
    };

    createDrone();
    const interval = setInterval(() => {
      this.currentChordIndex =
        (this.currentChordIndex + 1) % this.chordProgressions.length;
      createDrone();
    }, this.beatDuration * 8 * 1000);
    this.intervals.push(interval);
  }

  // Warm pad chords with filter movement
  private startChordLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const playChord = () => {
      if (!this.isPlaying || !this.masterGain) return;

      const chord = this.chordProgressions[this.currentChordIndex];

      chord.forEach((note, i) => {
        const freq = this.midiToFreq(note);

        // Detuned saw waves for warmth
        [-0.1, 0, 0.1].forEach((detune) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.detune.setValueAtTime(detune * 100, ctx.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(400, ctx.currentTime);
          filter.frequency.linearRampToValueAtTime(
            800 + Math.random() * 400,
            ctx.currentTime + this.beatDuration * 4
          );
          filter.frequency.linearRampToValueAtTime(
            300,
            ctx.currentTime + this.beatDuration * 8
          );
          filter.Q.setValueAtTime(2, ctx.currentTime);

          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.5);
          gain.gain.setValueAtTime(0.06, ctx.currentTime + this.beatDuration * 6);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + this.beatDuration * 8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain!);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + this.beatDuration * 8 + 0.5);

          this.activeOscillators.push(osc);
          this.activeGains.push(gain);
        });
      });
    };

    setTimeout(() => {
      playChord();
      const interval = setInterval(playChord, this.beatDuration * 8 * 1000);
      this.intervals.push(interval);
    }, 500);
  }

  // Mellow bass line
  private startBassLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const playBassNote = () => {
      if (!this.isPlaying || !this.masterGain) return;

      const chord = this.chordProgressions[this.currentChordIndex];
      const bassNotes = [chord[0] - 12, chord[0] - 12, chord[2] - 12, chord[0] - 12];
      const noteIndex = Math.floor((Date.now() / (this.beatDuration * 2000)) % 4);
      const freq = this.midiToFreq(bassNotes[noteIndex]);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + this.beatDuration * 1.5);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + this.beatDuration * 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + this.beatDuration * 2);

      this.activeOscillators.push(osc);
      this.activeGains.push(gain);
    };

    const interval = setInterval(playBassNote, this.beatDuration * 2 * 1000);
    this.intervals.push(interval);
  }

  // Lo-fi drum pattern
  private startRhythmLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    // Create noise buffer for hi-hat
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const playKick = () => {
      if (!this.isPlaying || !this.masterGain) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);

      this.activeOscillators.push(osc);
      this.activeGains.push(gain);
    };

    const playHihat = (accent: boolean = false) => {
      if (!this.isPlaying || !this.masterGain) return;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(8000, ctx.currentTime);

      const gain = ctx.createGain();
      const vol = accent ? 0.08 : 0.04;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.05);

      this.activeBufferSources.push(noise);
      this.activeGains.push(gain);
    };

    const playSnare = () => {
      if (!this.isPlaying || !this.masterGain) return;

      // Noise component
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(3000, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(1, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain!);

      noise.start(ctx.currentTime);
      noise.stop(ctx.currentTime + 0.15);

      // Tone component
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

      oscGain.gain.setValueAtTime(0.1, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);

      this.activeBufferSources.push(noise);
      this.activeOscillators.push(osc);
      this.activeGains.push(noiseGain, oscGain);
    };

    // Drum pattern: simple lo-fi beat
    let beatCount = 0;
    const playBeat = () => {
      if (!this.isPlaying) return;

      const subBeat = beatCount % 8;

      // Kick on 1 and 5
      if (subBeat === 0 || subBeat === 4) {
        playKick();
      }

      // Snare on 3 and 7
      if (subBeat === 2 || subBeat === 6) {
        playSnare();
      }

      // Hi-hat pattern with swing
      if (subBeat % 2 === 0) {
        playHihat(true);
      } else if (Math.random() > 0.3) {
        setTimeout(() => playHihat(false), this.beatDuration * 0.33 * 1000);
      }

      beatCount++;
    };

    setTimeout(() => {
      const interval = setInterval(playBeat, (this.beatDuration / 2) * 1000);
      this.intervals.push(interval);
    }, this.beatDuration * 2 * 1000);
  }

  // Gentle melodic phrases
  private startMelodyLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    const playMelodyPhrase = () => {
      if (!this.isPlaying || !this.masterGain) return;
      if (Math.random() > 0.4) return; // Only play sometimes

      const phraseLength = 3 + Math.floor(Math.random() * 3);
      let noteTime = ctx.currentTime;

      for (let i = 0; i < phraseLength; i++) {
        const noteIndex = Math.floor(Math.random() * this.melodyNotes.length);
        const freq = this.midiToFreq(this.melodyNotes[noteIndex]);
        const duration = this.beatDuration * (0.5 + Math.random() * 1);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, noteTime);

        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(0.08, noteTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(noteTime);
        osc.stop(noteTime + duration + 0.1);

        this.activeOscillators.push(osc);
        this.activeGains.push(gain);

        noteTime += duration;
      }
    };

    const schedulePhrase = () => {
      if (!this.isPlaying) return;
      playMelodyPhrase();
      const nextDelay = this.beatDuration * (4 + Math.random() * 8) * 1000;
      const timeout = setTimeout(schedulePhrase, nextDelay);
      this.intervals.push(timeout);
    };

    setTimeout(schedulePhrase, this.beatDuration * 8 * 1000);
  }

  // Vinyl crackle and atmosphere
  private startAtmosphereLayer(): void {
    const ctx = this.getContext();
    if (!this.masterGain) return;

    // Create vinyl crackle buffer
    const crackleBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const crackleData = crackleBuffer.getChannelData(0);
    for (let i = 0; i < crackleData.length; i++) {
      // Sparse crackle
      crackleData[i] = Math.random() > 0.997 ? (Math.random() - 0.5) * 0.5 : 0;
    }

    const playCrackle = () => {
      if (!this.isPlaying || !this.masterGain) return;

      const noise = ctx.createBufferSource();
      noise.buffer = crackleBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3000, ctx.currentTime);
      filter.Q.setValueAtTime(0.5, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      noise.start(ctx.currentTime);

      this.activeBufferSources.push(noise);
      this.activeGains.push(gain);
    };

    // Ambient shimmer
    const playShimmer = () => {
      if (!this.isPlaying || !this.masterGain) return;
      if (Math.random() > 0.3) return;

      const chord = this.chordProgressions[this.currentChordIndex];
      const note = chord[Math.floor(Math.random() * chord.length)] + 24;
      const freq = this.midiToFreq(note);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.5);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 3.5);

      this.activeOscillators.push(osc);
      this.activeGains.push(gain);
    };

    playCrackle();
    const shimmerInterval = setInterval(playShimmer, 2000);
    this.intervals.push(shimmerInterval);
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
