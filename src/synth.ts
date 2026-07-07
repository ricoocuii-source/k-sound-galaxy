/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SynthConfig } from './types';

class CosmicSynth {
  private ctx: AudioContext | null = null;
  private primaryGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  
  public analyser: AnalyserNode | null = null;
  
  private isPlaying: boolean = false;
  private intervalId: any = null;
  private currentStep: number = 0;
  private config: SynthConfig | null = null;

  // Real Audio Preview fields
  private audioEl: HTMLAudioElement | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;

  // Scale formulas (semitones from root)
  private scales = {
    major: [0, 2, 4, 7, 9, 12, 14, 16],
    minor: [0, 2, 3, 5, 7, 8, 10, 12],
    pentatonic: [0, 2, 4, 7, 9, 12, 14, 19],
    dorian: [0, 2, 3, 5, 7, 9, 10, 12],
  };

  constructor() {
    // Audio Context is lazily initialized on user gesture
  }

  public init() {
    if (this.ctx) return;
    
    // Create Audio Context
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtxClass();

    // Create Main nodes
    this.primaryGain = this.ctx.createGain();
    this.primaryGain.gain.value = 0.15; // Safe master volume

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1000;
    this.filter.Q.value = 2;

    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.4;

    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.4; // Feedback amount

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Connect LFO for filter sweeps
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.15; // Ultra slow sweep (0.15Hz)
    
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 400; // Modulate filter by 400Hz

    // Signal Routing:
    // Synth Note -> Filter -> Delay -> Analyser -> Output
    //                       \-> DelayFeedback -> Delay
    this.filter.connect(this.analyser);
    this.analyser.connect(this.primaryGain);
    this.primaryGain.connect(this.ctx.destination);

    // Delay routing
    this.filter.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay); // feedback loop
    this.delayFeedback.connect(this.analyser); // mix delay back

    // LFO connection
    this.lfo.connect(this.lfoGain);
    if (this.filter) {
      this.lfoGain.connect(this.filter.frequency);
    }
    
    try {
      this.lfo.start();
    } catch (e) {
      console.warn("LFO start error:", e);
    }
  }

  private getFrequencyForStep(step: number): number {
    if (!this.config) return 220;
    const scale = this.scales[this.config.scaleType] || this.scales.major;
    const noteIndex = step % scale.length;
    const octaveOffset = Math.floor(step / scale.length);
    const semitones = scale[noteIndex] + (octaveOffset * 12);
    
    // Frequency formula: f = f_0 * 2^(n/12)
    return this.config.baseFreq * Math.pow(2, semitones / 12);
  }

  public play(config: SynthConfig) {
    this.init();
    
    // Ensure Context is running (safeguard against browser suspended states)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.config = config;
    this.updateNodes();

    if (this.isPlaying) {
      this.stopInterval();
    }

    this.isPlaying = true;
    this.currentStep = 0;

    // Calculate step speed based on BPM
    const beatDurationMs = (60 / config.tempo) * 1000;
    const stepDurationMs = beatDurationMs / 2; // Eighth notes arpeggio

    this.intervalId = setInterval(() => {
      this.triggerNote();
    }, stepDurationMs);
  }

  private updateNodes() {
    if (!this.config || !this.filter || !this.delay || !this.delayFeedback) return;
    
    // Smooth transition filter & delay settings
    this.filter.frequency.value = this.config.filterFreq;
    this.filter.Q.value = this.config.resonance;
    this.delay.delayTime.value = this.config.delayTime;
  }

  private triggerNote() {
    if (!this.ctx || !this.filter || !this.config) return;

    // Arpeggiator pattern steps
    const pattern = [0, 2, 4, 3, 5, 7, 6, 9];
    const targetStep = pattern[this.currentStep % pattern.length];
    const freq = this.getFrequencyForStep(targetStep);

    // Create note oscillator
    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    osc.type = this.config.oscillatorType;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    // Gentle portamento/slid on electronic genres
    if (this.config.oscillatorType === 'square' || this.config.oscillatorType === 'sawtooth') {
      const slideFreq = this.getFrequencyForStep(pattern[(this.currentStep + 1) % pattern.length]);
      osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + 0.3);
    }

    // ADSR Envelope
    const now = this.ctx.currentTime;
    noteGain.gain.setValueAtTime(0.001, now);
    // Smooth attack
    noteGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    // Smooth decay/release
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    // Connections
    osc.connect(noteGain);
    noteGain.connect(this.filter);

    // Play & cleanup
    osc.start(now);
    osc.stop(now + 0.45);

    this.currentStep++;
  }

  public setVolume(volume: number) {
    if (this.primaryGain) {
      this.primaryGain.gain.value = volume * 0.15; // Scale to safe max 15%
    }
  }

  public playPreview(url: string) {
    this.init();
    if (!this.ctx || !this.analyser) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Stop procedural synth sequence
    this.pause();

    // Create single reusable audio element with CORS enabled
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.loop = true;

      try {
        this.audioSourceNode = this.ctx.createMediaElementSource(this.audioEl);
        this.audioSourceNode.connect(this.analyser);
      } catch (err) {
        console.warn("Failed to create media element source node:", err);
      }
    }

    // Change source and play
    this.audioEl.src = url;
    this.audioEl.load();
    this.audioEl.play().catch(err => {
      console.warn("Audio play failed, will try again on user interaction:", err);
    });
  }

  public stopPreview() {
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  public getPreviewProgress(): { currentTime: number; duration: number } {
    if (this.audioEl) {
      return {
        currentTime: this.audioEl.currentTime || 0,
        duration: this.audioEl.duration || 30
      };
    }
    return { currentTime: 0, duration: 30 };
  }

  public pause() {
    this.stopInterval();
    this.isPlaying = false;
    this.stopPreview();
  }

  private stopInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public cleanup() {
    this.pause();
    if (this.audioEl) {
      this.audioEl.src = '';
      this.audioEl = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const musicSynth = new CosmicSynth();
export default musicSynth;
