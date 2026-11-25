import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { SoundService } from '../../../services/sound.service';

export type PlayerSymbol = 'X' | 'O' | null;

interface TTTSavedState {
  board: PlayerSymbol[];
  currentPlayer: 'X' | 'O';
  gameMode: 'bot' | 'pvp';
  botDifficulty: 'smart' | 'normal';
}

@Component({
  selector: 'app-tic-tac-toe',
  templateUrl: './tic-tac-toe.page.html',
  styleUrls: ['./tic-tac-toe.page.scss'],
  standalone: false
})
export class TicTacToePage implements OnInit, OnDestroy {
  private storageService = inject(StorageService);
  public soundService = inject(SoundService);
  private cdr = inject(ChangeDetectorRef);

  board: PlayerSymbol[] = Array(9).fill(null);
  currentPlayer: 'X' | 'O' = 'X';
  winner: 'X' | 'O' | 'draw' | null = null;
  winningCombo: number[] = [];

  // Game Modes: 'bot' (1 player vs AI) or 'pvp' (2 players pass & play)
  gameMode: 'bot' | 'pvp' = 'bot';
  botDifficulty: 'smart' | 'normal' = 'smart';
  isBotThinking = false;

  // Scoreboard
  scoreX = 0; // Player 1 (or Human)
  scoreO = 0; // Player 2 (or Bot)
  scoreDraw = 0;

  private winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  private botTimeout: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadScores();
    await this.restoreOrResetGame();
    this.cdr.detectChanges();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadScores();
    await this.restoreOrResetGame();
    this.cdr.detectChanges();
  }

  ionViewWillLeave(): void {
    this.cleanupBotTimer();
    this.isBotThinking = false;
    this.persistCurrentState();
  }

  ngOnDestroy(): void {
    this.cleanupBotTimer();
    this.isBotThinking = false;
    this.persistCurrentState();
  }

  private cleanupBotTimer(): void {
    if (this.botTimeout !== null) {
      clearTimeout(this.botTimeout);
      this.botTimeout = null;
    }
  }

  async loadScores(): Promise<void> {
    const rawX = await this.storageService.get('ttt_score_x');
    const rawO = await this.storageService.get('ttt_score_o');
    const rawDraw = await this.storageService.get('ttt_score_draw');

    this.scoreX = rawX ? parseInt(rawX, 10) : 0;
    this.scoreO = rawO ? parseInt(rawO, 10) : 0;
    this.scoreDraw = rawDraw ? parseInt(rawDraw, 10) : 0;
  }

  private async restoreOrResetGame(): Promise<void> {
    const saved = await this.storageService.getGameState<TTTSavedState>('tic-tac-toe');
    if (
      saved &&
      saved.board &&
      saved.board.length === 9 &&
      saved.board.some(c => c !== null) &&
      !this.checkWin(saved.board, 'X') &&
      !this.checkWin(saved.board, 'O') &&
      !saved.board.every(c => c !== null)
    ) {
      this.board = saved.board;
      this.currentPlayer = saved.currentPlayer || 'X';
      this.gameMode = saved.gameMode || 'bot';
      this.botDifficulty = saved.botDifficulty || 'smart';
      this.winner = null;
      this.winningCombo = [];
      this.isBotThinking = false;

      // If resuming during bot turn
      if (this.gameMode === 'bot' && this.currentPlayer === 'O') {
        this.isBotThinking = true;
        this.botTimeout = setTimeout(() => {
          this.runBotMove();
        }, 120);
      }
    } else {
      if (!this.board || this.board.length !== 9) {
        this.board = Array(9).fill(null);
      }
      this.winner = null;
      this.winningCombo = [];
      this.isBotThinking = false;
    }
    this.cdr.detectChanges();
  }

  private async persistCurrentState(): Promise<void> {
    if (this.winner !== null) {
      await this.storageService.clearGameState('tic-tac-toe');
      return;
    }
    if (this.board.some(c => c !== null)) {
      await this.storageService.saveGameState<TTTSavedState>('tic-tac-toe', {
        board: this.board,
        currentPlayer: this.currentPlayer,
        gameMode: this.gameMode,
        botDifficulty: this.botDifficulty
      });
    } else {
      await this.storageService.clearGameState('tic-tac-toe');
    }
  }

  setGameMode(mode: 'bot' | 'pvp'): void {
    if (this.gameMode === mode) return;
    this.cleanupBotTimer();
    this.gameMode = mode;
    this.soundService.playClick();
    this.resetBoard();
  }

  setBotDifficulty(diff: 'smart' | 'normal'): void {
    if (this.botDifficulty === diff) return;
    this.cleanupBotTimer();
    this.botDifficulty = diff;
    this.soundService.playClick();
    this.resetBoard();
  }

  async resetBoard(): Promise<void> {
    this.cleanupBotTimer();
    this.soundService.playClick();
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.winner = null;
    this.winningCombo = [];
    this.isBotThinking = false;
    this.cdr.detectChanges();
    await this.storageService.clearGameState('tic-tac-toe');
  }

  async resetScores(): Promise<void> {
    this.soundService.playClick();
    this.scoreX = 0;
    this.scoreO = 0;
    this.scoreDraw = 0;
    await this.storageService.set('ttt_score_x', '0');
    await this.storageService.set('ttt_score_o', '0');
    await this.storageService.set('ttt_score_draw', '0');
    await this.storageService.set('highscore_tic-tac-toe', '0');
  }

  makeMove(index: number): void {
    if (this.board[index] || this.winner || this.isBotThinking) return;

    this.executeMove(index, this.currentPlayer);

    if (this.winner) return;

    if (this.gameMode === 'bot' && this.currentPlayer === 'O') {
      // Trigger bot turn with a realistic responsive delay
      this.isBotThinking = true;
      this.botTimeout = setTimeout(() => {
        this.runBotMove();
      }, 120);
    }
  }

  private executeMove(index: number, player: 'X' | 'O'): void {
    this.board[index] = player;
    this.soundService.playMove();
    this.soundService.triggerHaptic(20);

    // Check winner
    const combo = this.checkWin(this.board, player);
    if (combo) {
      this.winner = player;
      this.winningCombo = combo;
      this.handleGameEnd(player);
      this.storageService.clearGameState('tic-tac-toe');
      return;
    }

    // Check draw
    if (this.board.every(cell => cell !== null)) {
      this.winner = 'draw';
      this.handleGameEnd('draw');
      this.storageService.clearGameState('tic-tac-toe');
      return;
    }

    // Switch player
    this.currentPlayer = player === 'X' ? 'O' : 'X';
    this.persistCurrentState();
  }

  private runBotMove(): void {
    if (this.winner || !this.isBotThinking) return;

    let moveIndex = -1;

    if (this.botDifficulty === 'smart') {
      // Unbeatable Minimax
      moveIndex = this.getBestMinimaxMove();
    } else {
      // Normal: 50% minimax, 50% random
      if (Math.random() < 0.5) {
        moveIndex = this.getBestMinimaxMove();
      } else {
        const available = this.getAvailableIndices(this.board);
        moveIndex = available[Math.floor(Math.random() * available.length)];
      }
    }

    this.isBotThinking = false;
    if (moveIndex !== -1) {
      this.executeMove(moveIndex, 'O');
    }
  }

  private checkWin(board: PlayerSymbol[], player: 'X' | 'O'): number[] | null {
    for (const combo of this.winningCombinations) {
      if (
        board[combo[0]] === player &&
        board[combo[1]] === player &&
        board[combo[2]] === player
      ) {
        return combo;
      }
    }
    return null;
  }

  private getAvailableIndices(board: PlayerSymbol[]): number[] {
    const indices: number[] = [];
    board.forEach((val, idx) => {
      if (val === null) indices.push(idx);
    });
    return indices;
  }

  // Minimax Algorithm for unbeatable Bot
  private getBestMinimaxMove(): number {
    const available = this.getAvailableIndices(this.board);
    if (available.length === 9) {
      // First move: corners or center are best
      const openers = [0, 2, 4, 6, 8];
      return openers[Math.floor(Math.random() * openers.length)];
    }

    let bestScore = -Infinity;
    let bestMove = available[0];

    for (const index of available) {
      this.board[index] = 'O'; // Bot is O
      const score = this.minimax(this.board, 0, false);
      this.board[index] = null; // undo

      if (score > bestScore) {
        bestScore = score;
        bestMove = index;
      }
    }

    return bestMove;
  }

  private minimax(board: PlayerSymbol[], depth: number, isMaximizing: boolean): number {
    if (this.checkWin(board, 'O')) return 10 - depth;
    if (this.checkWin(board, 'X')) return depth - 10;
    if (board.every(cell => cell !== null)) return 0;

    const available = this.getAvailableIndices(board);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const index of available) {
        board[index] = 'O';
        const evalScore = this.minimax(board, depth + 1, false);
        board[index] = null;
        maxEval = Math.max(maxEval, evalScore);
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const index of available) {
        board[index] = 'X';
        const evalScore = this.minimax(board, depth + 1, true);
        board[index] = null;
        minEval = Math.min(minEval, evalScore);
      }
      return minEval;
    }
  }

  private async handleGameEnd(result: 'X' | 'O' | 'draw'): Promise<void> {
    if (result === 'X') {
      this.scoreX++;
      this.soundService.playWin();
      this.soundService.triggerHaptic(50);
      await this.storageService.set('ttt_score_x', this.scoreX.toString());
      // Save high score as highest X wins
      await this.storageService.saveHighScore('tic-tac-toe', this.scoreX);
    } else if (result === 'O') {
      this.scoreO++;
      this.soundService.playGameOver();
      this.soundService.triggerHaptic(50);
      await this.storageService.set('ttt_score_o', this.scoreO.toString());
    } else {
      this.scoreDraw++;
      this.soundService.playWrong();
      this.soundService.triggerHaptic(30);
      await this.storageService.set('ttt_score_draw', this.scoreDraw.toString());
    }
  }

  isWinningCell(index: number): boolean {
    return this.winningCombo.includes(index);
  }
}
