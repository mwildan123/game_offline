import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { SoundService } from '../../../services/sound.service';

interface Tile {
  id: number;
  value: number;
  isNew?: boolean;
  isMerged?: boolean;
}

interface GameStateSnapshot {
  grid: (number | null)[][];
  score: number;
}

interface Game2048SavedState {
  grid: (number | null)[][];
  score: number;
  canUndo: boolean;
  previousState: GameStateSnapshot | null;
  hasWon: boolean;
  keepPlayingAfterWin: boolean;
  isGameOver: boolean;
}

@Component({
  selector: 'app-game-2048',
  templateUrl: './game-2048.page.html',
  styleUrls: ['./game-2048.page.scss'],
  standalone: false
})
export class Game2048Page implements OnInit, OnDestroy {
  private storageService = inject(StorageService);
  public soundService = inject(SoundService);
  private cdr = inject(ChangeDetectorRef);

  readonly SIZE = 4;
  grid: (Tile | null)[][] = [];

  score = 0;
  highScore = 0;
  isGameOver = false;
  hasWon = false;
  keepPlayingAfterWin = false;
  isNewRecord = false;

  // Undo support (stores 1 step back)
  canUndo = false;
  private previousState: GameStateSnapshot | null = null;
  private nextTileId = 1;

  // Swipe detection
  private touchStartX = 0;
  private touchStartY = 0;

  constructor() {
    this.initDefaultGrid();
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
    this.persistCurrentState();
  }

  ngOnDestroy(): void {
    this.persistCurrentState();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (this.isGameOver) return;

    let moved = false;
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        moved = this.move('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        moved = this.move('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        moved = this.move('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        moved = this.move('right');
        break;
    }

    if (moved) {
      event.preventDefault();
    }
  }

  async loadHighScore(): Promise<void> {
    this.highScore = await this.storageService.getHighScore('game-2048');
  }

  private initDefaultGrid(): void {
    this.score = 0;
    this.isGameOver = false;
    this.hasWon = false;
    this.keepPlayingAfterWin = false;
    this.isNewRecord = false;
    this.canUndo = false;
    this.previousState = null;

    this.grid = [];
    for (let r = 0; r < this.SIZE; r++) {
      const row: (Tile | null)[] = [];
      for (let c = 0; c < this.SIZE; c++) {
        row.push(null);
      }
      this.grid.push(row);
    }

    this.spawnTile();
    this.spawnTile();
  }

  private async restoreOrStartGame(): Promise<void> {
    const saved = await this.storageService.getGameState<Game2048SavedState>('game-2048');
    if (
      saved &&
      !saved.isGameOver &&
      saved.grid &&
      saved.grid.length === this.SIZE
    ) {
      this.grid = saved.grid.map(row =>
        row.map(val => (val !== null ? { id: this.nextTileId++, value: val } : null))
      );
      this.score = saved.score || 0;
      this.canUndo = saved.canUndo || false;
      this.previousState = saved.previousState || null;
      this.hasWon = saved.hasWon || false;
      this.keepPlayingAfterWin = saved.keepPlayingAfterWin || false;
      this.isGameOver = false;
      this.isNewRecord = false;
    } else {
      if (!this.grid || this.grid.length !== this.SIZE || this.grid.every(r => r.every(c => c === null))) {
        this.initDefaultGrid();
      }
    }
    this.cdr.detectChanges();
  }

  private async persistCurrentState(): Promise<void> {
    if (this.isGameOver) {
      await this.storageService.clearGameState('game-2048');
      return;
    }
    const gridValues = this.grid.map(row =>
      row.map(cell => (cell ? cell.value : null))
    );
    await this.storageService.saveGameState<Game2048SavedState>('game-2048', {
      grid: gridValues,
      score: this.score,
      canUndo: this.canUndo,
      previousState: this.previousState,
      hasWon: this.hasWon,
      keepPlayingAfterWin: this.keepPlayingAfterWin,
      isGameOver: this.isGameOver
    });
  }

  async restartGame(): Promise<void> {
    this.soundService.playClick();
    this.initDefaultGrid();
    this.cdr.detectChanges();
    await this.storageService.clearGameState('game-2048');
  }

  undo(): void {
    if (!this.canUndo || !this.previousState) return;

    this.soundService.playClick();
    this.score = this.previousState.score;

    this.grid = this.previousState.grid.map(row =>
      row.map(val => (val !== null ? { id: this.nextTileId++, value: val } : null))
    );

    this.canUndo = false;
    this.previousState = null;
    this.isGameOver = false;
    this.cdr.detectChanges();
    this.persistCurrentState();
  }

  private spawnTile(): boolean {
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < this.SIZE; r++) {
      for (let c = 0; c < this.SIZE; c++) {
        if (!this.grid[r][c]) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length === 0) return false;

    const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    // 90% chance of 2, 10% chance of 4
    const value = Math.random() < 0.9 ? 2 : 4;
    this.grid[cell.r][cell.c] = {
      id: this.nextTileId++,
      value,
      isNew: true
    };

    return true;
  }

  move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (this.isGameOver) return false;

    // Clear previous animation flags
    for (let r = 0; r < this.SIZE; r++) {
      for (let c = 0; c < this.SIZE; c++) {
        if (this.grid[r][c]) {
          this.grid[r][c]!.isNew = false;
          this.grid[r][c]!.isMerged = false;
        }
      }
    }

    // Prepare state snapshot before moving
    const stateBefore = this.grid.map(row => row.map(cell => (cell ? cell.value : null)));
    const scoreBefore = this.score;

    let moved = false;
    let earnedPoints = 0;

    // Helper to slide and merge a single 1D array line
    const slideAndMerge = (line: (Tile | null)[]): (Tile | null)[] => {
      // 1. Filter out empty
      const nonNull = line.filter(t => t !== null) as Tile[];
      const result: (Tile | null)[] = [];

      for (let i = 0; i < nonNull.length; i++) {
        if (i < nonNull.length - 1 && nonNull[i].value === nonNull[i + 1].value) {
          // Merge
          const mergedValue = nonNull[i].value * 2;
          result.push({
            id: this.nextTileId++,
            value: mergedValue,
            isMerged: true
          });
          earnedPoints += mergedValue;
          if (mergedValue === 2048 && !this.keepPlayingAfterWin && !this.hasWon) {
            this.hasWon = true;
          }
          i++; // skip next merged tile
        } else {
          result.push(nonNull[i]);
        }
      }

      // Pad with nulls to original size
      while (result.length < this.SIZE) {
        result.push(null);
      }

      return result;
    };

    if (direction === 'left') {
      for (let r = 0; r < this.SIZE; r++) {
        const line = this.grid[r];
        const newLine = slideAndMerge(line);
        if (!this.arraysEqual(line, newLine)) moved = true;
        this.grid[r] = newLine;
      }
    } else if (direction === 'right') {
      for (let r = 0; r < this.SIZE; r++) {
        const line = [...this.grid[r]].reverse();
        const newLine = slideAndMerge(line).reverse();
        if (!this.arraysEqual(this.grid[r], newLine)) moved = true;
        this.grid[r] = newLine;
      }
    } else if (direction === 'up') {
      for (let c = 0; c < this.SIZE; c++) {
        const line: (Tile | null)[] = [];
        for (let r = 0; r < this.SIZE; r++) line.push(this.grid[r][c]);
        const newLine = slideAndMerge(line);
        if (!this.arraysEqual(line, newLine)) moved = true;
        for (let r = 0; r < this.SIZE; r++) this.grid[r][c] = newLine[r];
      }
    } else if (direction === 'down') {
      for (let c = 0; c < this.SIZE; c++) {
        const line: (Tile | null)[] = [];
        for (let r = 0; r < this.SIZE; r++) line.push(this.grid[r][c]);
        const reversedLine = [...line].reverse();
        const newLine = slideAndMerge(reversedLine).reverse();
        if (!this.arraysEqual(line, newLine)) moved = true;
        for (let r = 0; r < this.SIZE; r++) this.grid[r][c] = newLine[r];
      }
    }

    if (moved) {
      // Save snapshot for undo
      this.previousState = {
        grid: stateBefore,
        score: scoreBefore
      };
      this.canUndo = true;

      // Update score
      if (earnedPoints > 0) {
        this.score += earnedPoints;
        this.soundService.playScore();
        this.soundService.triggerHaptic(25);

        if (this.score > this.highScore) {
          this.highScore = this.score;
          this.isNewRecord = true;
          this.storageService.saveHighScore('game-2048', this.score);
        }
      } else {
        this.soundService.playMove();
      }

      // Spawn new tile
      this.spawnTile();

      // Check game over
      if (this.checkGameOver()) {
        this.isGameOver = true;
        this.soundService.playGameOver();
        this.soundService.triggerHaptic(60);
        this.storageService.saveHighScore('game-2048', this.score);
        this.storageService.clearGameState('game-2048');
      } else {
        this.persistCurrentState();
      }
    }

    return moved;
  }

  private arraysEqual(a: (Tile | null)[], b: (Tile | null)[]): boolean {
    for (let i = 0; i < a.length; i++) {
      const valA = a[i] ? a[i]!.value : null;
      const valB = b[i] ? b[i]!.value : null;
      if (valA !== valB) return false;
    }
    return true;
  }

  private checkGameOver(): boolean {
    // 1. Any empty cells?
    for (let r = 0; r < this.SIZE; r++) {
      for (let c = 0; c < this.SIZE; c++) {
        if (!this.grid[r][c]) return false;
      }
    }

    // 2. Any adjacent horizontal/vertical merges possible?
    for (let r = 0; r < this.SIZE; r++) {
      for (let c = 0; c < this.SIZE; c++) {
        const val = this.grid[r][c]!.value;
        if (c < this.SIZE - 1 && this.grid[r][c + 1]!.value === val) return false;
        if (r < this.SIZE - 1 && this.grid[r + 1][c]!.value === val) return false;
      }
    }

    return true;
  }

  continuePlaying(): void {
    this.keepPlayingAfterWin = true;
    this.hasWon = false;
    this.soundService.playClick();
    this.persistCurrentState();
  }

  // Touch Swipe tracking - instant sliding as finger moves
  private isSwiping = false;

  onTouchStart(event: TouchEvent): void {
    if (!event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isSwiping = true;
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isSwiping || this.isGameOver || !event.touches || event.touches.length === 0) return;

    const touch = event.touches[0];
    const diffX = touch.clientX - this.touchStartX;
    const diffY = touch.clientY - this.touchStartY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    const minSwipeDistance = 22; // Instant 22px response
    if (Math.max(absX, absY) >= minSwipeDistance) {
      if (absX > absY) {
        this.move(diffX > 0 ? 'right' : 'left');
      } else {
        this.move(diffY > 0 ? 'down' : 'up');
      }
      this.isSwiping = false; // Only one move per swipe gesture until release
    }
  }

  onTouchEnd(): void {
    this.isSwiping = false;
  }

  getTileClass(value: number): string {
    if (value <= 2048) {
      return `tile-${value}`;
    }
    return 'tile-super';
  }
}
