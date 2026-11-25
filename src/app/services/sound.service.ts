import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private storageService = inject(StorageService);
  private audioCtx: AudioContext | null = null;
  private muted = false;
  private volume = 0.8; // 0.0 - 1.0
  private hapticEnabled = true;

  constructor() {
    this.initAudioSettings();
    this.unlockAudioOnFirstInteraction();
  }

  private unlockAudioOnFirstInteraction(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
    window.addEventListener('click', unlock, { passive: true, once: true });
  }

  private async initAudioSettings(): Promise<void> {
    this.muted = await this.storageService.isMuted();
    const vol = await this.storageService.getVolume();
    this.volume = vol / 100;
    this.hapticEnabled = await this.storageService.isHapticEnabled();
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  isSoundMuted(): boolean {
    return this.muted;
  }

  async toggleMute(): Promise<boolean> {
    this.muted = !this.muted;
    await this.storageService.setMuted(this.muted);
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted;
    await this.storageService.setMuted(muted);
  }

  getVolumePercent(): number {
    return Math.round(this.volume * 100);
  }

  async setVolumePercent(percent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.volume = clamped / 100;
    await this.storageService.setVolume(clamped);
  }

  isHaptic(): boolean {
    return this.hapticEnabled;
  }

  async setHaptic(enabled: boolean): Promise<void> {
    this.hapticEnabled = enabled;
    await this.storageService.setHapticEnabled(enabled);
    if (enabled) {
      this.triggerHaptic(40);
    }
  }

  /**
   * Triggers haptic vibration if supported on the device and enabled by user
   */
  triggerHaptic(ms = 25): void {
    if (!this.hapticEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(ms);
      }
    } catch {
      // Haptics not supported or blocked
    }
  }

  /**
   * Helper to scale base gain by current volume level
   */
  private calcGain(base: number): number {
    return Math.max(0.001, base * this.volume);
  }

  playClick(): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

      gain.gain.setValueAtTime(this.calcGain(0.2), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }

  playMove(): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.08);

      gain.gain.setValueAtTime(this.calcGain(0.18), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  playScore(): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(this.calcGain(0.22), now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Note 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.07); // A5
      gain2.gain.setValueAtTime(this.calcGain(0.25), now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.22);
    } catch {}
  }

  playCombo(combo = 1): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const baseFreq = 440 + Math.min(combo, 8) * 60;
      const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const start = now + idx * 0.05;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(this.calcGain(0.2), start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch {}
  }

  playMatch(): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
      freqs.forEach((freq, idx) => {
        const start = now + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(this.calcGain(0.22), start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {}
  }

  playWrong(): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

      gain.gain.setValueAtTime(this.calcGain(0.15), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }

  playGameOver(): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 392, 349.23, 261.63]; // A4 -> G4 -> F4 -> C4
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(this.calcGain(0.2), start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch {}
  }

  playWin(): void {
    if (this.muted || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(this.calcGain(0.25), start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch {}
  }
}
