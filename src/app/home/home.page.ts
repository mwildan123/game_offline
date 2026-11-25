import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../services/storage.service';
import { SoundService } from '../services/sound.service';

export interface GameItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  route: string;
  logo: string;
  gradientClass: string;
  highScoreUnit?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  private router = inject(Router);
  private storageService = inject(StorageService);
  private soundService = inject(SoundService);
  private cdr = inject(ChangeDetectorRef);

  isDarkMode = true;
  isMuted = false;
  volumePercent = 80;
  isHaptic = true;
  isSettingsOpen = false;
  isResetAlertOpen = false;

  highScores: Record<string, number> = {};

  resetAlertButtons = [
    {
      text: 'Batal',
      role: 'cancel'
    },
    {
      text: 'Ya, Reset',
      role: 'destructive',
      handler: async () => {
        await this.storageService.resetAllHighScores();
        await this.loadHighScores();
        this.soundService.playClick();
      }
    }
  ];

  games: GameItem[] = [
    {
      id: 'block-blast',
      title: 'Puzzle Balok',
      subtitle: 'Teka-Teki Balok',
      description: 'Susun balok di papan 8×8, ledakkan garis & kumpulkan skor kombo!',
      route: '/games/block-blast',
      logo: 'assets/images/games/block-puzzle.png',
      gradientClass: 'gradient-cyan',
      highScoreUnit: 'pts'
    },
    {
      id: 'snake',
      title: 'Classic Snake',
      subtitle: 'Petualangan Ular',
      description: 'Makan apel, hindari tabrakan dengan kontrol Swipe & D-Pad responsif!',
      route: '/games/snake',
      logo: 'assets/images/games/snake.png',
      gradientClass: 'gradient-green',
      highScoreUnit: 'pts'
    },
    {
      id: 'game-2048',
      title: '2048',
      subtitle: 'Gabungkan Angka',
      description: 'Geser petak angka, gabungkan nilai kelipatan hingga mencapai 2048!',
      route: '/games/game-2048',
      logo: 'assets/images/games/game-2048.png',
      gradientClass: 'gradient-orange',
      highScoreUnit: 'pts'
    },
    {
      id: 'tic-tac-toe',
      title: 'Tic-Tac-Toe',
      subtitle: 'X & O Duel',
      description: 'Tantang Bot Pintar (Minimax AI) atau duel bersama teman di 1 HP!',
      route: '/games/tic-tac-toe',
      logo: 'assets/images/games/tic-tac-toe.png',
      gradientClass: 'gradient-rose',
      highScoreUnit: 'menang'
    },
    {
      id: 'memory-match',
      title: 'Memory Match',
      subtitle: 'Uji Ingatan Visual',
      description: 'Balik & temukan 8 pasang kartu dengan langkah paling sedikit!',
      route: '/games/memory-match',
      logo: 'assets/images/games/memory-match.png',
      gradientClass: 'gradient-purple',
      highScoreUnit: 'pts'
    }
  ];

  async ionViewWillEnter(): Promise<void> {
    await this.loadPreferences();
    await this.loadHighScores();
    this.cdr.detectChanges();
  }

  async loadPreferences(): Promise<void> {
    this.isDarkMode = await this.storageService.isDarkMode();
    this.isMuted = this.soundService.isSoundMuted();
    this.volumePercent = this.soundService.getVolumePercent();
    this.isHaptic = this.soundService.isHaptic();
    this.applyTheme(this.isDarkMode);
    this.cdr.detectChanges();
  }

  async loadHighScores(): Promise<void> {
    for (const game of this.games) {
      this.highScores[game.id] = await this.storageService.getHighScore(game.id);
    }
    this.cdr.detectChanges();
  }

  async openSettings(): Promise<void> {
    this.soundService.playClick();
    await this.loadPreferences();
    this.isSettingsOpen = true;
  }

  closeSettings(): void {
    this.isSettingsOpen = false;
  }

  async setTheme(dark: boolean): Promise<void> {
    if (this.isDarkMode === dark) return;
    this.isDarkMode = dark;
    this.soundService.playClick();
    await this.storageService.setDarkMode(this.isDarkMode);
    this.applyTheme(this.isDarkMode);
  }

  private applyTheme(isDark: boolean): void {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('ion-palette-dark', isDark);
    }
  }

  async toggleSound(event: CustomEvent): Promise<void> {
    const isEnabled = !!event.detail.checked;
    this.isMuted = !isEnabled;
    await this.soundService.setMuted(this.isMuted);
    if (isEnabled) {
      this.soundService.playClick();
    }
  }

  async onVolumeChange(event: CustomEvent): Promise<void> {
    const val = Number(event.detail.value);
    if (!isNaN(val)) {
      this.volumePercent = val;
      await this.soundService.setVolumePercent(val);
      if (val > 0 && this.isMuted) {
        this.isMuted = false;
        await this.soundService.setMuted(false);
      }
      this.soundService.playClick();
    }
  }

  async toggleHaptic(event: CustomEvent): Promise<void> {
    const isEnabled = !!event.detail.checked;
    this.isHaptic = isEnabled;
    await this.soundService.setHaptic(isEnabled);
  }

  openGame(game: GameItem): void {
    this.soundService.playClick();
    this.router.navigate([game.route]);
  }
}
