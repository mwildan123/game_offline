import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { StorageService } from '../../../services/storage.service';
import { SoundService } from '../../../services/sound.service';

interface Point {
  x: number;
  y: number;
}

interface SnakeSavedState {
  snake: Point[];
  direction: Point;
  nextDirection: Point;
  lastExecutedDirection: Point;
  food: Point;
  score: number;
  wallMode: 'pass' | 'solid';
  speedMode: 'slow' | 'normal' | 'fast';
  hasStarted: boolean;
  isGameOver: boolean;
}

@Component({
  selector: 'app-snake',
  templateUrl: './snake.page.html',
  styleUrls: ['./snake.page.scss'],
  standalone: false
})
export class SnakePage implements OnInit, OnDestroy {
  @ViewChild('snakeCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private storageService = inject(StorageService);
  public soundService = inject(SoundService);
  private cdr = inject(ChangeDetectorRef);

  // Grid constants
  readonly GRID_COUNT = 20; // 20x20 grid
  cellSize = 16;

  // Game state
  snake: Point[] = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];
  direction: Point = { x: 1, y: 0 };
  nextDirection: Point = { x: 1, y: 0 };
  lastExecutedDirection: Point = { x: 1, y: 0 };
  hasTurnedThisTick = false;
  food: Point = { x: 15, y: 10 };

  score = 0;
  highScore = 0;
  isGameOver = false;
  isPaused = false;
  isNewRecord = false;
  hasStarted = false;

  // Settings
  wallMode: 'pass' | 'solid' = 'pass'; // pass = Tembus Dinding, solid = Tabrak Dinding
  speedMode: 'slow' | 'normal' | 'fast' = 'normal';

  private gameLoopId: number | null = null;
  private lastTickTime = 0;
  private tickInterval = 110;

  // Touch Swipe tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private isSwiping = false;

  constructor() {
    this.initDefaultSnake();
  }

  async ngOnInit(): Promise<void> {
    await this.loadHighScore();
    await this.restoreOrResetGame();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadHighScore();
    await this.restoreOrResetGame();
    // Allow Ionic transition to complete before canvas re-measure
    setTimeout(() => {
      this.resizeCanvas();
      this.draw();
    }, 60);
  }

  ionViewWillLeave(): void {
    this.stopLoop();
    this.persistCurrentState();
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.persistCurrentState();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
    this.draw();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.setDirection(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.setDirection(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.setDirection(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.setDirection(1, 0);
        break;
      case ' ':
        this.togglePause();
        break;
    }
  }

  async loadHighScore(): Promise<void> {
    this.highScore = await this.storageService.getHighScore('snake');
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const clientW = parent && parent.clientWidth > 0 ? parent.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 360);
    const availableSize = Math.max(240, Math.min(clientW - 16, 380));
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.width = availableSize * dpr;
    canvas.height = availableSize * dpr;
    canvas.style.width = `${availableSize}px`;
    canvas.style.height = `${availableSize}px`;

    this.cellSize = (availableSize * dpr) / this.GRID_COUNT;
  }

  private initDefaultSnake(): void {
    this.snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.lastExecutedDirection = { x: 1, y: 0 };
    this.food = { x: 15, y: 10 };
    this.updateSpeedInterval();
  }

  private async restoreOrResetGame(): Promise<void> {
    const saved = await this.storageService.getGameState<SnakeSavedState>('snake');
    if (
      saved &&
      !saved.isGameOver &&
      saved.snake &&
      saved.snake.length >= 3 &&
      saved.food
    ) {
      this.snake = saved.snake;
      this.direction = saved.direction || { x: 1, y: 0 };
      this.nextDirection = saved.nextDirection || { x: 1, y: 0 };
      this.lastExecutedDirection = saved.lastExecutedDirection || { x: 1, y: 0 };
      this.food = saved.food;
      this.score = saved.score || 0;
      this.wallMode = saved.wallMode || 'pass';
      this.speedMode = saved.speedMode || 'normal';
      this.hasStarted = saved.hasStarted;
      this.isGameOver = false;
      this.isNewRecord = false;
      this.updateSpeedInterval();

      // If active game is resumed, keep it paused so player has time to react
      if (this.hasStarted) {
        this.isPaused = true;
      }
    } else {
      this.score = 0;
      this.isGameOver = false;
      this.isPaused = false;
      this.isNewRecord = false;
      this.hasStarted = false;
      this.initDefaultSnake();
    }

    this.resizeCanvas();
    this.draw();
    this.cdr.detectChanges();
  }

  private async persistCurrentState(): Promise<void> {
    if (this.isGameOver || !this.hasStarted) {
      await this.storageService.clearGameState('snake');
      return;
    }
    await this.storageService.saveGameState('snake', {
      snake: this.snake,
      direction: this.direction,
      nextDirection: this.nextDirection,
      lastExecutedDirection: this.lastExecutedDirection,
      food: this.food,
      score: this.score,
      wallMode: this.wallMode,
      speedMode: this.speedMode,
      hasStarted: this.hasStarted,
      isGameOver: this.isGameOver
    });
  }

  async resetGame(): Promise<void> {
    this.stopLoop();
    this.score = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.isNewRecord = false;
    this.hasStarted = false;
    this.hasTurnedThisTick = false;

    this.initDefaultSnake();
    this.spawnFood();
    this.resizeCanvas();
    this.draw();
    this.cdr.detectChanges();
    await this.storageService.clearGameState('snake');
  }

  startGame(): void {
    if (this.hasStarted && !this.isGameOver) return;
    this.stopLoop();
    this.score = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.isNewRecord = false;
    this.hasStarted = true;
    this.hasTurnedThisTick = false;

    this.initDefaultSnake();
    this.spawnFood();
    this.resizeCanvas();
    this.draw();

    this.soundService.playClick();
    this.lastTickTime = performance.now();
    this.startLoop();
    this.cdr.detectChanges();
    this.storageService.clearGameState('snake').catch(() => {});
  }

  setSpeed(speed: 'slow' | 'normal' | 'fast'): void {
    this.speedMode = speed;
    this.updateSpeedInterval();
    this.soundService.playClick();
    this.persistCurrentState();
  }

  setWallMode(mode: 'pass' | 'solid'): void {
    this.wallMode = mode;
    this.soundService.playClick();
    this.persistCurrentState();
    this.draw();
  }

  private updateSpeedInterval(): void {
    switch (this.speedMode) {
      case 'slow':
        this.tickInterval = 160;
        break;
      case 'fast':
        this.tickInterval = 75;
        break;
      case 'normal':
      default:
        this.tickInterval = 110;
        break;
    }
  }

  togglePause(): void {
    if (!this.hasStarted || this.isGameOver) return;
    this.isPaused = !this.isPaused;
    this.soundService.playClick();
    if (!this.isPaused) {
      this.lastTickTime = performance.now();
      this.startLoop();
    } else {
      this.stopLoop();
      this.draw();
    }
    this.cdr.detectChanges();
  }

  // D-Pad and Swipe controls with anti-180 self collision protection
  setDirection(dx: number, dy: number): void {
    if (this.isGameOver) return;

    if (!this.hasStarted) {
      this.startGame();
    } else if (this.isPaused) {
      // Resumes automatically on directional input
      this.isPaused = false;
      this.lastTickTime = performance.now();
      this.startLoop();
      this.cdr.detectChanges();
    }

    // Compare against the direction actually being executed to prevent rapid double-tap 180° self suicide
    const baseDir = this.hasTurnedThisTick ? this.nextDirection : this.lastExecutedDirection;

    if (dx !== 0 && baseDir.x !== -dx && baseDir.x !== dx) {
      this.nextDirection = { x: dx, y: 0 };
      this.hasTurnedThisTick = true;
      this.soundService.playClick();
    } else if (dy !== 0 && baseDir.y !== -dy && baseDir.y !== dy) {
      this.nextDirection = { x: 0, y: dy };
      this.hasTurnedThisTick = true;
      this.soundService.playClick();
    }
  }

  // Touch Swipe handlers - instant reaction during swipe motion
  onTouchStart(e: TouchEvent): void {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isSwiping = true;
  }

  onTouchMove(e: TouchEvent): void {
    if (!this.isSwiping || this.isGameOver || !e.touches || e.touches.length === 0) return;

    const touch = e.touches[0];
    const diffX = touch.clientX - this.touchStartX;
    const diffY = touch.clientY - this.touchStartY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    const minSwipe = 18; // Instant reaction at just 18px threshold
    if (Math.max(absX, absY) >= minSwipe) {
      if (absX > absY) {
        this.setDirection(diffX > 0 ? 1 : -1, 0);
      } else {
        this.setDirection(0, diffY > 0 ? 1 : -1);
      }
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    }
  }

  onTouchEnd(): void {
    this.isSwiping = false;
  }

  private startLoop(): void {
    if (this.gameLoopId !== null) return;

    const loop = (timestamp: number) => {
      if (!this.isPaused && !this.isGameOver) {
        if (timestamp - this.lastTickTime >= this.tickInterval) {
          this.tick();
          this.lastTickTime = timestamp;
        }
        this.draw();
        this.gameLoopId = requestAnimationFrame(loop);
      }
    };

    this.gameLoopId = requestAnimationFrame(loop);
  }

  private stopLoop(): void {
    if (this.gameLoopId !== null) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
  }

  private tick(): void {
    this.direction = { ...this.nextDirection };
    this.lastExecutedDirection = { ...this.direction };
    this.hasTurnedThisTick = false;

    let headX = this.snake[0].x + this.direction.x;
    let headY = this.snake[0].y + this.direction.y;

    // Wall collision handling
    if (this.wallMode === 'pass') {
      if (headX < 0) headX = this.GRID_COUNT - 1;
      else if (headX >= this.GRID_COUNT) headX = 0;

      if (headY < 0) headY = this.GRID_COUNT - 1;
      else if (headY >= this.GRID_COUNT) headY = 0;
    } else {
      // Solid wall: hitting border = Game Over
      if (headX < 0 || headX >= this.GRID_COUNT || headY < 0 || headY >= this.GRID_COUNT) {
        this.triggerGameOver();
        return;
      }
    }

    // Self collision handling
    for (let i = 0; i < this.snake.length - 1; i++) {
      if (this.snake[i].x === headX && this.snake[i].y === headY) {
        this.triggerGameOver();
        return;
      }
    }

    const newHead: Point = { x: headX, y: headY };
    this.snake.unshift(newHead);

    // Food collision
    if (headX === this.food.x && headY === this.food.y) {
      this.score += 10;
      this.soundService.playScore();
      this.soundService.triggerHaptic(30);

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.isNewRecord = true;
        this.storageService.saveHighScore('snake', this.score);
      }

      this.spawnFood();
      this.persistCurrentState();
    } else {
      this.snake.pop();
    }
  }

  private spawnFood(): void {
    const emptyCells: Point[] = [];
    for (let x = 0; x < this.GRID_COUNT; x++) {
      for (let y = 0; y < this.GRID_COUNT; y++) {
        const isOccupied = this.snake.some(seg => seg.x === x && seg.y === y);
        if (!isOccupied) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) {
      this.triggerGameOver();
      return;
    }

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    this.food = randomCell;
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.stopLoop();
    this.soundService.playGameOver();
    this.soundService.triggerHaptic(60);
    this.storageService.saveHighScore('snake', this.score);
    this.storageService.clearGameState('snake');
    this.draw();
    this.cdr.detectChanges();
  }

  private draw(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cs = this.cellSize;

    // Clear background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= this.GRID_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cs, 0);
      ctx.lineTo(i * cs, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cs);
      ctx.lineTo(w, i * cs);
      ctx.stroke();
    }

    // Border highlight if solid wall mode
    if (this.wallMode === 'solid') {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }

    // Draw Food (glowing apple)
    const fx = this.food.x * cs + cs / 2;
    const fy = this.food.y * cs + cs / 2;
    const fr = cs * 0.42;

    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();

    // Apple highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Snake
    for (let i = 0; i < this.snake.length; i++) {
      const seg = this.snake[i];
      const sx = seg.x * cs;
      const sy = seg.y * cs;
      const pad = 1.5;

      if (i === 0) {
        // Head
        ctx.fillStyle = '#22c55e';
        this.fillRoundedRect(ctx, sx + pad, sy + pad, cs - pad * 2, cs - pad * 2, cs * 0.3);

        // Eyes
        ctx.fillStyle = '#ffffff';
        const eyeRadius = cs * 0.12;
        let eye1X = sx + cs * 0.3;
        let eye1Y = sy + cs * 0.3;
        let eye2X = sx + cs * 0.7;
        let eye2Y = sy + cs * 0.3;

        if (this.direction.x === 1) {
          eye1X = sx + cs * 0.65; eye1Y = sy + cs * 0.25;
          eye2X = sx + cs * 0.65; eye2Y = sy + cs * 0.75;
        } else if (this.direction.x === -1) {
          eye1X = sx + cs * 0.35; eye1Y = sy + cs * 0.25;
          eye2X = sx + cs * 0.35; eye2Y = sy + cs * 0.75;
        } else if (this.direction.y === 1) {
          eye1X = sx + cs * 0.25; eye1Y = sy + cs * 0.65;
          eye2X = sx + cs * 0.75; eye2Y = sy + cs * 0.65;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeRadius * 0.6, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body with gradient falloff
        const alpha = Math.max(0.45, 1 - (i / this.snake.length) * 0.45);
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        this.fillRoundedRect(ctx, sx + pad, sy + pad, cs - pad * 2, cs - pad * 2, cs * 0.22);
      }
    }
  }

  private fillRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}
