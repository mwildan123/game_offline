import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private memoryCache: Map<string, string> = new Map();

  async set(key: string, value: string): Promise<void> {
    this.memoryCache.set(key, value);
    try {
      await Preferences.set({ key, value });
    } catch {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch (err) {
        console.warn('LocalStorage unavailable:', err);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) ?? null;
    }

    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        this.memoryCache.set(key, value);
        return value;
      }
    } catch {
      // Fallback to localStorage
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) {
          this.memoryCache.set(key, val);
          return val;
        }
      }
    } catch (err) {
      console.warn('LocalStorage read error:', err);
    }

    return null;
  }

  async remove(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await Preferences.remove({ key });
    } catch {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {}
    }
  }

  async getHighScore(gameKey: string): Promise<number> {
    const raw = await this.get(`highscore_${gameKey}`);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Saves high score if higher than current record.
   * Returns true if a new high score was set.
   */
  async saveHighScore(gameKey: string, score: number): Promise<boolean> {
    const current = await this.getHighScore(gameKey);
    if (score > current) {
      await this.set(`highscore_${gameKey}`, score.toString());
      return true;
    }
    return false;
  }

  /**
   * Resets all high scores across all games
   */
  async resetAllHighScores(): Promise<void> {
    const gameKeys = ['block-blast', 'snake', 'game-2048', 'tic-tac-toe', 'memory-match'];
    for (const key of gameKeys) {
      await this.remove(`highscore_${key}`);
    }
    await this.remove('ttt_score_x');
    await this.remove('ttt_score_o');
    await this.remove('ttt_score_draw');
  }

  async isDarkMode(): Promise<boolean> {
    const val = await this.get('setting_dark_mode');
    if (val !== null) {
      return val === 'true';
    }
    // Default to dark mode for modern gaming feel
    return true;
  }

  async setDarkMode(enabled: boolean): Promise<void> {
    await this.set('setting_dark_mode', enabled ? 'true' : 'false');
  }

  async isMuted(): Promise<boolean> {
    const val = await this.get('setting_sound_muted');
    return val === 'true';
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.set('setting_sound_muted', muted ? 'true' : 'false');
  }

  async getVolume(): Promise<number> {
    const val = await this.get('setting_sound_volume');
    if (val !== null) {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 80 : Math.max(0, Math.min(100, parsed));
    }
    return 80;
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    await this.set('setting_sound_volume', clamped.toString());
  }

  async isHapticEnabled(): Promise<boolean> {
    const val = await this.get('setting_haptic_enabled');
    if (val !== null) {
      return val === 'true';
    }
    return true; // Default enabled
  }

  async setHapticEnabled(enabled: boolean): Promise<void> {
    await this.set('setting_haptic_enabled', enabled ? 'true' : 'false');
  }

  async saveGameState<T>(gameKey: string, state: T): Promise<void> {
    try {
      await this.set(`gamestate_${gameKey}`, JSON.stringify(state));
    } catch (err) {
      console.warn(`Failed to save state for ${gameKey}:`, err);
    }
  }

  async getGameState<T>(gameKey: string): Promise<T | null> {
    try {
      const raw = await this.get(`gamestate_${gameKey}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async clearGameState(gameKey: string): Promise<void> {
    await this.remove(`gamestate_${gameKey}`);
  }
}
