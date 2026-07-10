/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Audio controller for the bottom player: plays 30s iTunes previews through
 * Web Audio so the shared analyser can drive audio-reactive visuals.
 */

class PreviewAudio {
  private ctx: AudioContext | null = null;
  private primaryGain: GainNode | null = null;

  public analyser: AnalyserNode | null = null;

  private audioEl: HTMLAudioElement | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;

  constructor() {
    // Audio Context is lazily initialized on user gesture
  }

  public init() {
    if (this.ctx) return;

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtxClass();

    this.primaryGain = this.ctx.createGain();
    this.primaryGain.gain.value = 0.15; // Safe master volume

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.analyser.connect(this.primaryGain);
    this.primaryGain.connect(this.ctx.destination);
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

    // Create single reusable audio element with CORS enabled
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.loop = true;

      try {
        this.audioSourceNode = this.ctx.createMediaElementSource(this.audioEl);
        this.audioSourceNode.connect(this.analyser);
      } catch (err) {
        console.warn('Failed to create media element source node:', err);
      }
    }

    // Change source and play
    this.audioEl.src = url;
    this.audioEl.load();
    this.audioEl.play().catch((err) => {
      console.warn('Audio play failed, will try again on user interaction:', err);
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
        duration: this.audioEl.duration || 30,
      };
    }
    return { currentTime: 0, duration: 30 };
  }

  public pause() {
    this.stopPreview();
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

export const musicSynth = new PreviewAudio();
export default musicSynth;
