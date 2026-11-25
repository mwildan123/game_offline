import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { SoundService } from '../../../services/sound.service';

export interface BlockPiece {
  id: number;
  matrix: number[][]; // 2D array: 1 = block, 0 = empty
  color: string;
  width: number;
  height: number;
  used: boolean;
}

export interface BoardCell {
  filled: boolean;
  color: string;
  clearing: boolean;
}

interface BlockBlastSavedState {
  board: BoardCell[][];
  pieces: BlockPiece[];
  score: number;
  combo: number;
  isGameOver: boolean;
}

@Component({
  selector: 'app-block-blast',
  templateUrl: './block-blast.page.html',
  styleUrls: ['./block-blast.page.scss'],
  standalone: false
})
export class BlockBlastPage implements OnInit, OnDestroy {
  @ViewChild('boardRef', { static: false }) boardRef!: ElementRef<HTMLDivElement>;
  @ViewChild('dragPreviewRef', { static: false }) dragPreviewRef?: ElementRef<HTMLDivElement>;

  private storageService = inject(StorageService);
  public soundService = inject(SoundService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  readonly GRID_SIZE = 8;
  board: BoardCell[][] = [];
  ghostGrid: boolean[][] = [];

  // Available pieces in bottom slot
  pieces: BlockPiece[] = [];

  score = 0;
  highScore = 0;
  combo = 0;
  isGameOver = false;
  isNewRecord = false;

  // Cached layout dimensions to eliminate layout thrashing
  private boardRect: DOMRect | null = null;
  private cachedCellSize = 0;

  constructor() {
    this.initEmptyBoard();
    this.spawnNewPieces();
  }

  // Dragging state
  isDragging = false;
  draggedPiece: BlockPiece | null = null;
  draggedPieceIndex = -1;
  dragX = 0;
  dragY = 0;

  // Hover ghost coords on 8x8 grid
  hoverRow = -1;
  hoverCol = -1;
  canPlaceHover = false;

  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  private shapeTemplates: { matrix: number[][]; color: string }[] = [
    // 1x1
    { matrix: [[1]], color: '#06b6d4' },
    // 1x2, 2x1
    { matrix: [[1, 1]], color: '#3b82f6' },
    { matrix: [[1], [1]], color: '#3b82f6' },
    // 1x3, 3x1
    { matrix: [[1, 1, 1]], color: '#10b981' },
    { matrix: [[1], [1], [1]], color: '#10b981' },
    // 1x4, 4x1
    { matrix: [[1, 1, 1, 1]], color: '#8b5cf6' },
    { matrix: [[1], [1], [1], [1]], color: '#8b5cf6' },
    // 1x5, 5x1
    { matrix: [[1, 1, 1, 1, 1]], color: '#ec4899' },
    { matrix: [[1], [1], [1], [1], [1]], color: '#ec4899' },
    // 2x2 square
    { matrix: [[1, 1], [1, 1]], color: '#f59e0b' },
    // 3x3 square
    { matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], color: '#ef4444' },
    // L-corner 2x2
    { matrix: [[1, 1], [1, 0]], color: '#6366f1' },
    { matrix: [[1, 1], [0, 1]], color: '#6366f1' },
    { matrix: [[1, 0], [1, 1]], color: '#6366f1' },
    { matrix: [[0, 1], [1, 1]], color: '#6366f1' },
    // L-shape 3x3
    { matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], color: '#14b8a6' },
    { matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], color: '#14b8a6' },
    { matrix: [[1, 1, 1], [1, 0, 0], [1, 0, 0]], color: '#14b8a6' },
    { matrix: [[1, 1, 1], [0, 0, 1], [0, 0, 1]], color: '#14b8a6' },
    // T-shapes
    { matrix: [[1, 1, 1], [0, 1, 0]], color: '#d946ef' },
    { matrix: [[0, 1, 0], [1, 1, 1]], color: '#d946ef' },
    { matrix: [[1, 0], [1, 1], [1, 0]], color: '#d946ef' },
    { matrix: [[0, 1], [1, 1], [0, 1]], color: '#d946ef' },
    // Z and S shapes
    { matrix: [[1, 1, 0], [0, 1, 1]], color: '#eab308' },
    { matrix: [[0, 1, 1], [1, 1, 0]], color: '#eab308' },
    { matrix: [[1, 0], [1, 1], [0, 1]], color: '#eab308' },
    { matrix: [[0, 1], [1, 1], [1, 0]], color: '#eab308' }
  ];

  // Document listener references for clean teardown
  private onPointerMoveBound = this.onPointerMove.bind(this);
  private onPointerUpBound = this.onPointerUp.bind(this);

  async loadHighScore(): Promise<void> {
    this.highScore = await this.storageService.getHighScore('block-blast');
  }

  private attachGlobalListeners(): void {
    if (typeof window !== 'undefined') {
      this.cleanupListeners();
      // Run drag pointer events outside Angular zone to eliminate Zone.js change detection flooding
      this.ngZone.runOutsideAngular(() => {
        window.addEventListener('pointermove', this.onPointerMoveBound, { passive: true });
        window.addEventListener('pointerup', this.onPointerUpBound, { passive: true });
        window.addEventListener('pointercancel', this.onPointerUpBound, { passive: true });
      });
    }
  }

  private cleanupListeners(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.onPointerMoveBound);
      window.removeEventListener('pointerup', this.onPointerUpBound);
      window.removeEventListener('pointercancel', this.onPointerUpBound);
    }
  }

  private clearPendingTimers(): void {
    if (this.clearTimer !== null) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadHighScore();
    await this.restoreOrStartGame();
    this.attachGlobalListeners();
    this.cdr.detectChanges();
  }

  async ionViewWillEnter(): Promise<void> {
    this.attachGlobalListeners();
    await this.loadHighScore();
    await this.restoreOrStartGame();
    this.cdr.detectChanges();
    setTimeout(() => {
      this.measureBoard();
      this.cdr.detectChanges();
    }, 50);
  }

  ionViewWillLeave(): void {
    this.cleanupListeners();
    this.clearPendingTimers();
    this.persistCurrentState();
  }

  ngOnDestroy(): void {
    this.cleanupListeners();
    this.clearPendingTimers();
    this.persistCurrentState();
  }

  private measureBoard(): void {
    if (this.boardRef?.nativeElement) {
      this.boardRect = this.boardRef.nativeElement.getBoundingClientRect();
      this.cachedCellSize = this.boardRect.width / this.GRID_SIZE;
    }
  }

  private async restoreOrStartGame(): Promise<void> {
    const saved = await this.storageService.getGameState<BlockBlastSavedState>('block-blast');
    if (
      saved &&
      !saved.isGameOver &&
      saved.board &&
      saved.board.length === this.GRID_SIZE &&
      saved.pieces &&
      saved.pieces.length === 3
    ) {
      this.board = saved.board;
      this.pieces = saved.pieces;
      this.score = saved.score || 0;
      this.combo = saved.combo || 0;
      this.isGameOver = false;
      this.isNewRecord = false;
      this.resetGhostGrid();
    } else {
      this.startFreshGame();
    }
    this.cdr.detectChanges();
  }

  private async persistCurrentState(): Promise<void> {
    if (this.isGameOver) {
      await this.storageService.clearGameState('block-blast');
      return;
    }
    await this.storageService.saveGameState('block-blast', {
      board: this.board,
      pieces: this.pieces,
      score: this.score,
      combo: this.combo,
      isGameOver: this.isGameOver
    });
  }

  async restartGame(): Promise<void> {
    this.soundService.playClick();
    this.clearPendingTimers();
    this.startFreshGame();
    this.cdr.detectChanges();
    await this.storageService.clearGameState('block-blast');
  }

  private startFreshGame(): void {
    this.score = 0;
    this.combo = 0;
    this.isGameOver = false;
    this.isNewRecord = false;
    this.hoverRow = -1;
    this.hoverCol = -1;
    this.initEmptyBoard();
    this.spawnNewPieces();
  }

  private initEmptyBoard(): void {
    this.board = [];
    this.ghostGrid = [];
    for (let r = 0; r < this.GRID_SIZE; r++) {
      const row: BoardCell[] = [];
      const ghostRow: boolean[] = [];
      for (let c = 0; c < this.GRID_SIZE; c++) {
        row.push({ filled: false, color: '', clearing: false });
        ghostRow.push(false);
      }
      this.board.push(row);
      this.ghostGrid.push(ghostRow);
    }
  }

  private resetGhostGrid(): void {
    for (let r = 0; r < this.GRID_SIZE; r++) {
      for (let c = 0; c < this.GRID_SIZE; c++) {
        this.ghostGrid[r][c] = false;
      }
    }
  }

  spawnNewPieces(): void {
    this.pieces = [];
    for (let i = 0; i < 3; i++) {
      const template = this.shapeTemplates[Math.floor(Math.random() * this.shapeTemplates.length)];
      this.pieces.push({
        id: Date.now() + i,
        matrix: template.matrix,
        color: template.color,
        width: template.matrix[0].length,
        height: template.matrix.length,
        used: false
      });
    }

    this.checkGameOver();
  }

  // Pointer drag start
  onPiecePointerDown(event: PointerEvent, piece: BlockPiece, index: number): void {
    if (piece.used || this.isGameOver) return;

    this.isDragging = true;
    this.draggedPiece = piece;
    this.draggedPieceIndex = index;

    // Cache board bounding box once to avoid layout thrashing during move
    this.measureBoard();

    // Offset position upwards by 75px so thumb doesn't cover block
    this.dragX = event.clientX;
    this.dragY = event.clientY - 75;

    this.soundService.playClick();
    this.updateHoverCoordsFast(this.dragX, this.dragY);

    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch { }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || !this.draggedPiece) return;

    this.dragX = event.clientX;
    this.dragY = event.clientY - 75;

    // Direct GPU transform update for butter-smooth 60/120 FPS tracking
    if (this.dragPreviewRef?.nativeElement) {
      this.dragPreviewRef.nativeElement.style.transform =
        `translate3d(${this.dragX}px, ${this.dragY}px, 0) translate(-50%, -50%)`;
    }

    this.updateHoverCoordsFast(this.dragX, this.dragY);
  }

  private onPointerUp(): void {
    if (!this.isDragging || !this.draggedPiece) return;

    const piece = this.draggedPiece;
    const pIdx = this.draggedPieceIndex;
    const canPlace = this.canPlaceHover;
    const r = this.hoverRow;
    const c = this.hoverCol;

    this.ngZone.run(() => {
      if (canPlace && r >= 0 && c >= 0) {
        this.placePiece(piece, pIdx, r, c);
      }

      this.isDragging = false;
      this.draggedPiece = null;
      this.draggedPieceIndex = -1;
      this.hoverRow = -1;
      this.hoverCol = -1;
      this.canPlaceHover = false;
      this.resetGhostGrid();
      this.cdr.markForCheck();
    });
  }

  private updateHoverCoordsFast(clientX: number, clientY: number): void {
    const piece = this.draggedPiece;
    if (!piece) return;

    if (!this.boardRect || this.cachedCellSize <= 0) {
      this.measureBoard();
      if (!this.boardRect || this.cachedCellSize <= 0) return;
    }

    const cellSize = this.cachedCellSize;
    const pieceCenterX = (piece.width * cellSize) / 2;
    const pieceCenterY = (piece.height * cellSize) / 2;

    const boardRelativeX = clientX - this.boardRect.left - pieceCenterX + cellSize / 2;
    const boardRelativeY = clientY - this.boardRect.top - pieceCenterY + cellSize / 2;

    const col = Math.round(boardRelativeX / cellSize);
    const row = Math.round(boardRelativeY / cellSize);

    let newRow = -1;
    let newCol = -1;
    let canPlace = false;

    if (row >= 0 && row < this.GRID_SIZE && col >= 0 && col < this.GRID_SIZE) {
      if (this.canPlace(piece, row, col)) {
        newRow = row;
        newCol = col;
        canPlace = true;
      }
    }

    // ONLY trigger Angular Change Detection when the piece actually enters a DIFFERENT slot!
    if (newRow !== this.hoverRow || newCol !== this.hoverCol || canPlace !== this.canPlaceHover) {
      this.ngZone.run(() => {
        this.hoverRow = newRow;
        this.hoverCol = newCol;
        this.canPlaceHover = canPlace;
        this.applyGhostGrid();
        this.cdr.markForCheck();
      });
    }
  }

  private applyGhostGrid(): void {
    this.resetGhostGrid();
    if (this.canPlaceHover && this.draggedPiece && this.hoverRow >= 0 && this.hoverCol >= 0) {
      const h = this.draggedPiece.matrix.length;
      const w = this.draggedPiece.matrix[0].length;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (this.draggedPiece.matrix[r][c] === 1) {
            const br = this.hoverRow + r;
            const bc = this.hoverCol + c;
            if (br < this.GRID_SIZE && bc < this.GRID_SIZE) {
              this.ghostGrid[br][bc] = true;
            }
          }
        }
      }
    }
  }

  canPlace(piece: BlockPiece, startRow: number, startCol: number): boolean {
    const h = piece.matrix.length;
    const w = piece.matrix[0].length;

    if (startRow + h > this.GRID_SIZE || startCol + w > this.GRID_SIZE) {
      return false;
    }

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (piece.matrix[r][c] === 1) {
          if (this.board[startRow + r][startCol + c].filled) {
            return false;
          }
        }
      }
    }

    return true;
  }

  placePiece(piece: BlockPiece, pieceIndex: number, row: number, col: number): void {
    let placedCount = 0;
    const h = piece.matrix.length;
    const w = piece.matrix[0].length;

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (piece.matrix[r][c] === 1) {
          this.board[row + r][col + c] = {
            filled: true,
            color: piece.color,
            clearing: false
          };
          placedCount++;
        }
      }
    }

    this.addScore(placedCount);
    this.soundService.playMove();

    piece.used = true;

    const linesCleared = this.checkLines();

    const allUsed = this.pieces.every(p => p.used);
    if (allUsed) {
      this.spawnNewPieces();
    } else if (!linesCleared) {
      this.checkGameOver();
    }
  }

  checkLines(): boolean {
    const rowsToClear: number[] = [];
    const colsToClear: number[] = [];

    for (let r = 0; r < this.GRID_SIZE; r++) {
      let full = true;
      for (let c = 0; c < this.GRID_SIZE; c++) {
        if (!this.board[r][c].filled) {
          full = false;
          break;
        }
      }
      if (full) rowsToClear.push(r);
    }

    for (let c = 0; c < this.GRID_SIZE; c++) {
      let full = true;
      for (let r = 0; r < this.GRID_SIZE; r++) {
        if (!this.board[r][c].filled) {
          full = false;
          break;
        }
      }
      if (full) colsToClear.push(c);
    }

    const totalLines = rowsToClear.length + colsToClear.length;
    if (totalLines > 0) {
      this.combo++;

      rowsToClear.forEach(r => {
        for (let c = 0; c < this.GRID_SIZE; c++) {
          this.board[r][c].clearing = true;
        }
      });
      colsToClear.forEach(c => {
        for (let r = 0; r < this.GRID_SIZE; r++) {
          this.board[r][c].clearing = true;
        }
      });

      if (this.combo > 1) {
        this.soundService.playCombo(this.combo);
        this.soundService.triggerHaptic(50);
      } else {
        this.soundService.playScore();
        this.soundService.triggerHaptic(35);
      }

      const lineScore = totalLines * 8 * 10 * this.combo;
      this.addScore(lineScore);

      this.clearTimer = setTimeout(() => {
        rowsToClear.forEach(r => {
          for (let c = 0; c < this.GRID_SIZE; c++) {
            this.board[r][c] = { filled: false, color: '', clearing: false };
          }
        });
        colsToClear.forEach(c => {
          for (let r = 0; r < this.GRID_SIZE; r++) {
            this.board[r][c] = { filled: false, color: '', clearing: false };
          }
        });

        this.checkGameOver();
        this.persistCurrentState();
        this.cdr.detectChanges();
      }, 180);
      return true;
    } else {
      this.combo = 0;
      this.persistCurrentState();
      return false;
    }
  }

  private addScore(amount: number): void {
    this.score += amount;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewRecord = true;
      this.storageService.saveHighScore('block-blast', this.score);
    }
  }

  checkGameOver(): void {
    const availablePieces = this.pieces.filter(p => !p.used);
    if (availablePieces.length === 0) return;

    for (const piece of availablePieces) {
      for (let r = 0; r <= this.GRID_SIZE - piece.matrix.length; r++) {
        for (let c = 0; c <= this.GRID_SIZE - piece.matrix[0].length; c++) {
          if (this.canPlace(piece, r, c)) {
            return;
          }
        }
      }
    }

    this.triggerGameOver();
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.soundService.playGameOver();
    this.soundService.triggerHaptic(60);
    this.storageService.saveHighScore('block-blast', this.score);
    this.storageService.clearGameState('block-blast');
  }
}
