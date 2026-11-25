import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { SoundService } from '../../../services/sound.service';

export interface MemoryCard {
  id: number;
  icon: string;
  color: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface MemorySavedState {
  cards: MemoryCard[];
  moves: number;
  matchedPairs: number;
  secondsElapsed: number;
  hasStarted: boolean;
  isGameOver: boolean;
}

@Component({
  selector: 'app-memory-match',
  templateUrl: './memory-match.page.html',
  styleUrls: ['./memory-match.page.scss'],
  standalone: false
})
export class MemoryMatchPage implements OnInit, OnDestroy {
  private storageService = inject(StorageService);
  public soundService = inject(SoundService);
  private cdr = inject(ChangeDetectorRef);

  cards: MemoryCard[] = [];
  flippedCards: MemoryCard[] = [];

  moves = 0;
  matchedPairs = 0;
  totalPairs = 8;
  score = 0;
  highScore = 0;

  secondsElapsed = 0;
  timerInterval: number | null = null;
  hasStarted = false;

  isGameOver = false;
  isNewRecord = false;
  isLocked = false; // Prevents clicking during flip back delay

  // 8 distinct icon presets with matching colors
  private cardIcons = [
    { icon: 'flame', color: '#ef4444' },
    { icon: 'planet', color: '#8b5cf6' },
    { icon: 'flash', color: '#eab308' },
    { icon: 'heart', color: '#ec4899' },
    { icon: 'rocket', color: '#06b6d4' },
    { icon: 'diamond', color: '#3b82f6' },
    { icon: 'leaf', color: '#10b981' },
    { icon: 'star', color: '#f59e0b' }
  ];

  private mismatchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initDefaultDeck();
  }

  async ngOnInit(): Promise<void> {
    await this.loadHighScore();
    await this.restoreOrStartGame();
    this.cdr.detectChanges();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadHighScore();
    await this.restoreOrStartGame();
    this.cdr.detectChanges();
  }

  ionViewWillLeave(): void {
    this.stopTimer();
    this.cleanupMismatchTimer();
    this.persistCurrentState();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.cleanupMismatchTimer();
    this.persistCurrentState();
  }

  private cleanupMismatchTimer(): void {
    if (this.mismatchTimeout !== null) {
      clearTimeout(this.mismatchTimeout);
      this.mismatchTimeout = null;
    }
  }

  async loadHighScore(): Promise<void> {
    this.highScore = await this.storageService.getHighScore('memory-match');
  }

  private initDefaultDeck(): void {
    this.moves = 0;
    this.matchedPairs = 0;
    this.score = 0;
    this.secondsElapsed = 0;
    this.hasStarted = false;
    this.isGameOver = false;
    this.isNewRecord = false;
    this.isLocked = false;
    this.flippedCards = [];

    // Create 16 cards (8 pairs) and shuffle
    const deck: MemoryCard[] = [];
    let idCounter = 1;

    this.cardIcons.forEach(item => {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: idCounter++,
          icon: item.icon,
          color: item.color,
          isFlipped: false,
          isMatched: false
        });
      }
    });

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.cards = deck;
  }

  private async restoreOrStartGame(): Promise<void> {
    const saved = await this.storageService.getGameState<MemorySavedState>('memory-match');
    if (
      saved &&
      !saved.isGameOver &&
      saved.cards &&
      saved.cards.length === 16 &&
      saved.matchedPairs < this.totalPairs
    ) {
      // Re-hydrate cards; unmatched cards are closed to avoid locks
      this.cards = saved.cards.map(c => ({
        ...c,
        isFlipped: c.isMatched
      }));
      this.moves = saved.moves || 0;
      this.matchedPairs = saved.matchedPairs || 0;
      this.secondsElapsed = saved.secondsElapsed || 0;
      this.hasStarted = saved.hasStarted || false;
      this.isGameOver = false;
      this.isNewRecord = false;
      this.isLocked = false;
      this.flippedCards = [];

      if (this.hasStarted) {
        this.startTimer();
      }
    } else {
      if (!this.cards || this.cards.length !== 16) {
        this.initDefaultDeck();
      }
    }
    this.cdr.detectChanges();
  }

  private async persistCurrentState(): Promise<void> {
    if (this.isGameOver || this.matchedPairs === this.totalPairs || !this.hasStarted) {
      await this.storageService.clearGameState('memory-match');
      return;
    }
    await this.storageService.saveGameState<MemorySavedState>('memory-match', {
      cards: this.cards,
      moves: this.moves,
      matchedPairs: this.matchedPairs,
      secondsElapsed: this.secondsElapsed,
      hasStarted: this.hasStarted,
      isGameOver: this.isGameOver
    });
  }

  async restartGame(): Promise<void> {
    this.soundService.playClick();
    this.stopTimer();
    this.cleanupMismatchTimer();
    this.initDefaultDeck();
    this.cdr.detectChanges();
    await this.storageService.clearGameState('memory-match');
  }

  private startTimer(): void {
    if (this.timerInterval !== null) return;
    this.timerInterval = window.setInterval(() => {
      this.secondsElapsed++;
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  flipCard(card: MemoryCard): void {
    if (this.isLocked || card.isFlipped || card.isMatched || this.isGameOver) return;

    if (!this.hasStarted) {
      this.hasStarted = true;
      this.startTimer();
    }

    this.soundService.playClick();
    card.isFlipped = true;
    this.flippedCards.push(card);
    this.cdr.detectChanges();

    if (this.flippedCards.length === 2) {
      this.moves++;
      this.checkPairMatch();
    }
  }

  private checkPairMatch(): void {
    const [card1, card2] = this.flippedCards;

    if (card1.icon === card2.icon) {
      // Match found!
      this.soundService.playMatch();
      this.soundService.triggerHaptic(40);
      card1.isMatched = true;
      card2.isMatched = true;
      this.matchedPairs++;
      this.flippedCards = [];
      this.cdr.detectChanges();

      // Check victory
      if (this.matchedPairs === this.totalPairs) {
        this.handleVictory();
      } else {
        this.persistCurrentState();
      }
    } else {
      // Mismatch
      this.isLocked = true;
      this.mismatchTimeout = setTimeout(() => {
        this.soundService.playWrong();
        this.soundService.triggerHaptic(20);
        card1.isFlipped = false;
        card2.isFlipped = false;
        this.flippedCards = [];
        this.isLocked = false;
        this.mismatchTimeout = null;
        this.cdr.detectChanges();
      }, 750);
    }
  }

  private async handleVictory(): Promise<void> {
    this.stopTimer();

    // Score formula: (1000 - moves*20 - seconds*5) + base 500, minimum 100
    const calculatedScore = Math.max(100, 1500 - (this.moves * 25) - (this.secondsElapsed * 8));
    this.score = calculatedScore;

    this.soundService.playWin();
    this.soundService.triggerHaptic(60);
    this.isGameOver = true;
    this.cdr.detectChanges();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewRecord = true;
      await this.storageService.saveHighScore('memory-match', this.score);
    }

    await this.storageService.clearGameState('memory-match');
  }
}
