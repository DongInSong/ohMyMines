import type { Cell, Position, PlayerCursor, ZoneType, TreasureCell } from 'shared';
import {
  CELL_SIZE,
  CELL_PADDING,
  CELL_COLORS,
  NUMBER_COLORS,
  ZONE_COLORS,
  ZONE_LAYOUT,
  MAP_WIDTH,
  MAP_HEIGHT,
  TREASURE,
} from 'shared';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  center: Position;
  zoom: number;
  playerId?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Explosion {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  particles: Particle[];
}

interface RevealEffect {
  cells: Position[];
  startTime: number;
  duration: number;
  intensity: number; // Based on number of cells revealed
}

interface PixelWave {
  startTime: number;
  duration: number;
  originX: number;
  originY: number;
  color: string;
  speed: number;
  type: 'radial' | 'horizontal' | 'vertical';
}

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cellSize: number = CELL_SIZE;
  private offset: Position = { x: 0, y: 0 };

  // Explosion effects
  private explosions: Explosion[] = [];
  private screenShake: { intensity: number; startTime: number; duration: number } | null = null;
  private recentMines: Map<string, number> = new Map(); // Track recently revealed mines for glow effect

  // Reveal effects
  private revealEffects: RevealEffect[] = [];
  private recentReveals: Map<string, number> = new Map(); // Track recently revealed cells for glow

  // Ambient visual effects
  private pixelWaves: PixelWave[] = [];
  private globalTime: number = 0;

  // Mobile detection & optimization
  private isMobile: boolean = false;
  private maxDpr: number = 3;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Detect mobile via pointer type or screen size
    this.isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    this.maxDpr = this.isMobile ? 2 : 3;
  }

  // Call this when a mine explodes
  triggerExplosion(worldX: number, worldY: number) {
    const particles: Particle[] = [];
    const particleCount = this.isMobile ? 15 : 30;
    const colors = ['#ff4444', '#ff8800', '#ffcc00', '#ffffff', '#ff0000'];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 5,
      });
    }

    this.explosions.push({
      x: worldX,
      y: worldY,
      startTime: Date.now(),
      duration: 1000,
      particles,
    });

    // Trigger screen shake
    this.screenShake = {
      intensity: 8,
      startTime: Date.now(),
      duration: 500,
    };

    // Track this mine for glow effect
    this.recentMines.set(`${worldX},${worldY}`, Date.now());
  }

  // Call this when cells are revealed
  triggerReveal(cells: Position[]) {
    if (cells.length === 0) return;

    // Calculate intensity based on number of cells (1-10 cells = low, 11-30 = medium, 31+ = high)
    const intensity = Math.min(1, cells.length / 20);
    const duration = 600 + intensity * 400; // 600ms to 1000ms based on intensity

    this.revealEffects.push({
      cells,
      startTime: Date.now(),
      duration,
      intensity,
    });

    // Track cells for individual glow effect (limit to 100 for performance)
    const now = Date.now();
    const maxTracked = 100;
    const step = cells.length <= maxTracked ? 1 : Math.ceil(cells.length / maxTracked);
    for (let i = 0; i < cells.length; i += step) {
      const cell = cells[i];
      this.recentReveals.set(`${cell.x},${cell.y}`, now);
    }

    // Also limit total tracked reveals
    if (this.recentReveals.size > 500) {
      const entries = Array.from(this.recentReveals.entries());
      entries.sort((a, b) => a[1] - b[1]); // Sort by time
      const toRemove = entries.slice(0, entries.length - 500);
      for (const [key] of toRemove) {
        this.recentReveals.delete(key);
      }
    }

    // Calculate center of revealed cells
    let centerX = 0, centerY = 0;
    for (const cell of cells) {
      centerX += cell.x;
      centerY += cell.y;
    }
    centerX /= cells.length;
    centerY /= cells.length;

    // Random vibrant color
    const colors = ['#00ffff', '#ff00ff', '#00ff88', '#ffff00', '#ff6b6b', '#6b6bff'];
    const randomColor = () => colors[Math.floor(Math.random() * colors.length)];

    // Add pixel wave effects based on reveal size
    if (cells.length >= 50) {
      this.triggerPixelWave(centerX, centerY, randomColor(), 'radial', 800);
      this.screenShake = { intensity: 3, startTime: now, duration: 200 };
    } else if (cells.length >= 30) {
      this.triggerPixelWave(centerX, centerY, randomColor(), 'radial', 700);
      this.screenShake = { intensity: 2, startTime: now, duration: 150 };
    } else if (cells.length >= 15) {
      this.triggerPixelWave(centerX, centerY, randomColor(), 'radial', 600);
      this.screenShake = { intensity: 1, startTime: now, duration: 100 };
    } else if (cells.length >= 5) {
      this.triggerPixelWave(centerX, centerY, randomColor(), 'radial', 500);
    }
  }

  // Trigger a pixel wave effect (limited to max 5 concurrent waves, fewer on mobile)
  private triggerPixelWave(originX: number, originY: number, color: string, type: 'radial' | 'horizontal' | 'vertical', duration: number) {
    // Limit concurrent waves for performance (fewer on mobile)
    const maxWaves = this.isMobile ? 2 : 5;
    if (this.pixelWaves.length >= maxWaves) {
      this.pixelWaves.shift(); // Remove oldest wave
    }

    this.pixelWaves.push({
      startTime: Date.now(),
      duration,
      originX,
      originY,
      color,
      speed: 35, // cells per second (reduced for performance)
      type,
    });
  }

  private updateMetrics(center: Position, zoom: number) {
    this.cellSize = CELL_SIZE * zoom;

    // Apply screen shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake) {
      const elapsed = Date.now() - this.screenShake.startTime;
      if (elapsed < this.screenShake.duration) {
        const progress = elapsed / this.screenShake.duration;
        const intensity = this.screenShake.intensity * (1 - progress);
        shakeX = (Math.random() - 0.5) * intensity * 2;
        shakeY = (Math.random() - 0.5) * intensity * 2;
      } else {
        this.screenShake = null;
      }
    }

    this.offset = {
      x: this.canvas.width / 2 - center.x * this.cellSize + shakeX,
      y: this.canvas.height / 2 - center.y * this.cellSize + shakeY,
    };
  }

  private worldToScreen(x: number, y: number): Position {
    return {
      x: this.offset.x + x * this.cellSize,
      y: this.offset.y + y * this.cellSize,
    };
  }

  getZoneAtPosition(x: number, y: number): ZoneType {
    for (const zone of ZONE_LAYOUT) {
      if (
        x >= zone.bounds.startX &&
        x < zone.bounds.endX &&
        y >= zone.bounds.startY &&
        y < zone.bounds.endY
      ) {
        return zone.type;
      }
    }
    return 'beginner';
  }

  render(
    center: Position,
    zoom: number,
    cells: Map<string, Cell>,
    cursors: PlayerCursor[],
    playerId: string | undefined,
    scanHighlights: Position[],
    hoveredCell: Position | null,
    treasures: TreasureCell[] = []
  ) {
    this.updateMetrics(center, zoom);
    this.globalTime = Date.now();

    // Update pixel waves
    this.updatePixelWaves();

    // Clear canvas with subtle gradient
    this.drawBackground();

    // Calculate visible range
    const startX = Math.max(0, Math.floor(center.x - this.canvas.width / 2 / this.cellSize) - 1);
    const startY = Math.max(0, Math.floor(center.y - this.canvas.height / 2 / this.cellSize) - 1);
    const endX = Math.min(MAP_WIDTH - 1, Math.ceil(center.x + this.canvas.width / 2 / this.cellSize) + 1);
    const endY = Math.min(MAP_HEIGHT - 1, Math.ceil(center.y + this.canvas.height / 2 / this.cellSize) + 1);

    // Draw zone backgrounds
    this.drawZoneBackgrounds(startX, startY, endX, endY);

    // Draw cells with pixel wave effects
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const cell = cells.get(`${x},${y}`);
        const waveGlow = this.getPixelWaveGlow(x, y);
        this.drawCell(x, y, cell, playerId, hoveredCell, waveGlow);
      }
    }

    // Draw scan highlights
    this.drawScanHighlights(scanHighlights);

    // Draw reveal effects
    this.drawRevealEffects();

    // Draw explosions
    this.drawExplosions();

    // Draw treasures
    this.drawTreasures(treasures, startX, startY, endX, endY);

    // Draw other player cursors
    this.drawCursors(cursors, startX, startY, endX, endY);

    // Draw grid lines (if zoomed in enough, skip on mobile at low zoom)
    const gridThreshold = this.isMobile ? 1.2 : 1;
    if (zoom >= gridThreshold) {
      this.drawGrid(startX, startY, endX, endY);
    }

    // Draw zone borders with neon glow (simplified on mobile at low zoom)
    if (!this.isMobile || zoom >= 0.7) {
      this.drawZoneBorders();
    }

    // Clean up old mines from glow tracking
    const now = Date.now();
    for (const [key, time] of this.recentMines) {
      if (now - time > 3000) {
        this.recentMines.delete(key);
      }
    }

    // Clean up old reveals from glow tracking
    for (const [key, time] of this.recentReveals) {
      if (now - time > 1000) {
        this.recentReveals.delete(key);
      }
    }
  }

  private updatePixelWaves() {
    const now = this.globalTime;
    this.pixelWaves = this.pixelWaves.filter(wave => now - wave.startTime < wave.duration);
  }

  private getPixelWaveGlow(cellX: number, cellY: number): { color: string; intensity: number } | null {
    // Early exit if no waves
    if (this.pixelWaves.length === 0) return null;

    let maxIntensity = 0;
    let color = '';
    const waveThickness = 5;

    for (const wave of this.pixelWaves) {
      const elapsed = (this.globalTime - wave.startTime) / 1000;
      const waveRadius = elapsed * wave.speed;
      const progress = (this.globalTime - wave.startTime) / wave.duration;

      let distFromWave: number;

      if (wave.type === 'radial') {
        const dx = cellX - wave.originX;
        const dy = cellY - wave.originY;
        const distSq = dx * dx + dy * dy;
        const minR = waveRadius - waveThickness;
        const maxR = waveRadius + waveThickness;

        if (distSq < minR * minR || distSq > maxR * maxR) continue;

        const distance = Math.sqrt(distSq);
        distFromWave = Math.abs(distance - waveRadius);
      } else if (wave.type === 'horizontal') {
        const distance = Math.abs(cellY - wave.originY);
        distFromWave = Math.abs(distance - waveRadius);
        if (distFromWave >= waveThickness) continue;
      } else {
        const distance = Math.abs(cellX - wave.originX);
        distFromWave = Math.abs(distance - waveRadius);
        if (distFromWave >= waveThickness) continue;
      }

      // Intensity based on distance from wave center and overall progress
      const localIntensity = (1 - distFromWave / waveThickness) * (1 - progress * 0.7);
      if (localIntensity > maxIntensity) {
        maxIntensity = localIntensity;
        color = wave.color;
      }
    }

    return maxIntensity > 0.05 ? { color, intensity: maxIntensity } : null;
  }

  private drawZoneBackgrounds(startX: number, startY: number, endX: number, endY: number) {
    const time = this.globalTime / 3000;

    for (const zone of ZONE_LAYOUT) {
      const zoneStartX = Math.max(zone.bounds.startX, startX);
      const zoneStartY = Math.max(zone.bounds.startY, startY);
      const zoneEndX = Math.min(zone.bounds.endX, endX + 1);
      const zoneEndY = Math.min(zone.bounds.endY, endY + 1);

      if (zoneStartX >= zoneEndX || zoneStartY >= zoneEndY) continue;

      const screenStart = this.worldToScreen(zoneStartX, zoneStartY);
      const screenEnd = this.worldToScreen(zoneEndX, zoneEndY);
      const width = screenEnd.x - screenStart.x;
      const height = screenEnd.y - screenStart.y;

      // Base color
      this.ctx.fillStyle = ZONE_COLORS[zone.type].bg;
      this.ctx.fillRect(screenStart.x, screenStart.y, width, height);

      // Add animated gradient overlay for danger zones
      if (zone.type === 'danger' || zone.type === 'mystery') {
        const pulse = Math.sin(time * 2 + zone.bounds.startX * 0.01) * 0.5 + 0.5;
        const gradient = this.ctx.createRadialGradient(
          screenStart.x + width / 2,
          screenStart.y + height / 2,
          0,
          screenStart.x + width / 2,
          screenStart.y + height / 2,
          Math.max(width, height) / 2
        );
        const borderColor = ZONE_COLORS[zone.type].border;
        gradient.addColorStop(0, `${borderColor}${Math.floor(pulse * 20).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, 'transparent');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(screenStart.x, screenStart.y, width, height);
      }

      // Add subtle shimmer effect to all zones
      const shimmerPhase = (time + zone.bounds.startX * 0.005) % 1;
      const shimmerX = screenStart.x + shimmerPhase * width * 2 - width;
      const shimmerGradient = this.ctx.createLinearGradient(
        shimmerX, screenStart.y,
        shimmerX + width * 0.3, screenStart.y
      );
      shimmerGradient.addColorStop(0, 'transparent');
      shimmerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
      shimmerGradient.addColorStop(1, 'transparent');

      this.ctx.fillStyle = shimmerGradient;
      this.ctx.fillRect(screenStart.x, screenStart.y, width, height);
    }
  }

  private drawCell(
    x: number,
    y: number,
    cell: Cell | undefined,
    playerId: string | undefined,
    hoveredCell: Position | null,
    waveGlow: { color: string; intensity: number } | null = null
  ) {
    const screen = this.worldToScreen(x, y);
    const size = this.cellSize - CELL_PADDING * 2;
    const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
    const cellKey = `${x},${y}`;
    const mineTime = this.recentMines.get(cellKey);
    const revealTime = this.recentReveals.get(cellKey);

    // Draw cell background
    let bgColor: string = CELL_COLORS.hidden;

    if (!cell || cell.state === 'hidden') {
      bgColor = isHovered ? CELL_COLORS.hiddenHover : CELL_COLORS.hidden;
    } else if (cell.state === 'flagged') {
      bgColor = CELL_COLORS.flagged;
    } else if (cell.state === 'revealed') {
      if (cell.isMine) {
        bgColor = CELL_COLORS.mineExploded;
      } else if (cell.adjacentMines === 0) {
        bgColor = CELL_COLORS.revealedEmpty;
      } else {
        bgColor = CELL_COLORS.revealed;
      }
    }

    // Highlight own cells
    if (cell && cell.revealedBy === playerId && cell.state === 'revealed' && !cell.isMine) {
      bgColor = this.adjustColor(bgColor, 20);
    }

    // Apply wave glow to hidden cells (creates the pixel wave effect)
    if (waveGlow && (!cell || cell.state === 'hidden')) {
      const centerX = screen.x + CELL_PADDING + size / 2;
      const centerY = screen.y + CELL_PADDING + size / 2;
      const glowSize = size * (0.8 + waveGlow.intensity * 0.3);

      // Draw neon glow under the cell
      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, glowSize
      );
      gradient.addColorStop(0, `${waveGlow.color}${Math.floor(waveGlow.intensity * 180).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(0.6, `${waveGlow.color}${Math.floor(waveGlow.intensity * 80).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, 'transparent');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(
        centerX - glowSize,
        centerY - glowSize,
        glowSize * 2,
        glowSize * 2
      );
    }

    // Draw pulsing glow for recently exploded mines
    if (cell?.isMine && cell.state === 'revealed' && mineTime) {
      const elapsed = Date.now() - mineTime;
      if (elapsed < 3000) {
        const pulsePhase = (elapsed / 200) % (Math.PI * 2);
        const glowIntensity = 0.3 + 0.2 * Math.sin(pulsePhase);
        const glowSize = size * (1.5 + 0.3 * Math.sin(pulsePhase));

        // Draw glow
        const gradient = this.ctx.createRadialGradient(
          screen.x + CELL_PADDING + size / 2,
          screen.y + CELL_PADDING + size / 2,
          0,
          screen.x + CELL_PADDING + size / 2,
          screen.y + CELL_PADDING + size / 2,
          glowSize
        );
        gradient.addColorStop(0, `rgba(255, 0, 0, ${glowIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 0, ${glowIntensity * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(
          screen.x + CELL_PADDING + size / 2 - glowSize,
          screen.y + CELL_PADDING + size / 2 - glowSize,
          glowSize * 2,
          glowSize * 2
        );
      }
    }

    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(
      screen.x + CELL_PADDING,
      screen.y + CELL_PADDING,
      size,
      size
    );

    // Draw glow for recently revealed cells (non-mine)
    if (revealTime && cell?.state === 'revealed' && !cell.isMine) {
      const elapsed = Date.now() - revealTime;
      if (elapsed < 800) {
        const progress = elapsed / 800;
        const glowAlpha = (1 - progress) * 0.4;
        const centerX = screen.x + CELL_PADDING + size / 2;
        const centerY = screen.y + CELL_PADDING + size / 2;

        // Draw inner highlight
        const gradient = this.ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, size * 0.8
        );
        gradient.addColorStop(0, `rgba(150, 220, 255, ${glowAlpha})`);
        gradient.addColorStop(0.6, `rgba(100, 180, 255, ${glowAlpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(100, 180, 255, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(
          screen.x + CELL_PADDING,
          screen.y + CELL_PADDING,
          size,
          size
        );

        // Border highlight
        this.ctx.strokeStyle = `rgba(150, 220, 255, ${glowAlpha * 1.5})`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
          screen.x + CELL_PADDING + 1,
          screen.y + CELL_PADDING + 1,
          size - 2,
          size - 2
        );
      }
    }

    // Draw cell content
    if (cell) {
      this.drawCellContent(screen, size, cell, mineTime);
    }
  }

  private drawCellContent(screen: Position, size: number, cell: Cell, mineTime?: number) {
    const centerX = screen.x + CELL_PADDING + size / 2;
    const centerY = screen.y + CELL_PADDING + size / 2;

    if (cell.state === 'flagged') {
      // Draw flag
      this.ctx.fillStyle = '#1a1a1a';
      this.ctx.font = `${size * 0.6}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🚩', centerX, centerY);
    } else if (cell.state === 'revealed') {
      if (cell.isMine) {
        // Draw mine with enhanced effects
        const elapsed = mineTime ? Date.now() - mineTime : 3000;
        const isRecent = elapsed < 3000;

        // Outer ring animation for recent mines
        if (isRecent) {
          const ringProgress = (elapsed % 500) / 500;
          const ringSize = size * 0.3 + size * 0.4 * ringProgress;
          const ringAlpha = 1 - ringProgress;

          this.ctx.strokeStyle = `rgba(255, 100, 0, ${ringAlpha})`;
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, ringSize, 0, Math.PI * 2);
          this.ctx.stroke();
        }

        // Draw mine body (larger and more prominent)
        const mineSize = isRecent ? size * 0.35 + size * 0.05 * Math.sin(elapsed / 100) : size * 0.35;

        // Mine gradient
        const mineGradient = this.ctx.createRadialGradient(
          centerX - mineSize * 0.3,
          centerY - mineSize * 0.3,
          0,
          centerX,
          centerY,
          mineSize
        );
        mineGradient.addColorStop(0, '#666666');
        mineGradient.addColorStop(0.5, '#333333');
        mineGradient.addColorStop(1, '#000000');

        this.ctx.fillStyle = mineGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, mineSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw spikes
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4 + (isRecent ? elapsed / 1000 : 0);
          const innerRadius = mineSize * 0.7;
          const outerRadius = mineSize * 1.4;
          this.ctx.beginPath();
          this.ctx.moveTo(
            centerX + Math.cos(angle) * innerRadius,
            centerY + Math.sin(angle) * innerRadius
          );
          this.ctx.lineTo(
            centerX + Math.cos(angle) * outerRadius,
            centerY + Math.sin(angle) * outerRadius
          );
          this.ctx.stroke();
        }

        // Highlight on mine
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(centerX - mineSize * 0.3, centerY - mineSize * 0.3, mineSize * 0.2, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw skull emoji for recent explosions
        if (isRecent && elapsed < 1500) {
          const skullAlpha = 1 - elapsed / 1500;
          const skullY = centerY - size * 0.8 - (elapsed / 1500) * size * 0.5;
          this.ctx.globalAlpha = skullAlpha;
          this.ctx.font = `${size * 0.5}px Arial`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('💀', centerX, skullY);
          this.ctx.globalAlpha = 1;
        }
      } else if (cell.adjacentMines > 0) {
        // Draw number
        this.ctx.fillStyle = NUMBER_COLORS[cell.adjacentMines] || '#1f2937';
        this.ctx.font = `bold ${size * 0.6}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(cell.adjacentMines.toString(), centerX, centerY);
      }
    }
  }

  private drawExplosions() {
    const now = Date.now();
    const activeExplosions: Explosion[] = [];

    for (const explosion of this.explosions) {
      const elapsed = now - explosion.startTime;
      if (elapsed >= explosion.duration) continue;

      activeExplosions.push(explosion);
      const progress = elapsed / explosion.duration;
      const screen = this.worldToScreen(explosion.x + 0.5, explosion.y + 0.5);

      // Draw shockwave ring
      const ringRadius = this.cellSize * (1 + progress * 3);
      const ringAlpha = 1 - progress;

      this.ctx.strokeStyle = `rgba(255, 200, 0, ${ringAlpha})`;
      this.ctx.lineWidth = 4 * (1 - progress);
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, ringRadius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Draw second ring
      const ring2Radius = this.cellSize * (0.5 + progress * 2);
      this.ctx.strokeStyle = `rgba(255, 100, 0, ${ringAlpha * 0.7})`;
      this.ctx.lineWidth = 3 * (1 - progress);
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, ring2Radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Draw flash
      if (progress < 0.2) {
        const flashAlpha = (0.2 - progress) / 0.2;
        const flashSize = this.cellSize * 2;
        const flashGradient = this.ctx.createRadialGradient(
          screen.x, screen.y, 0,
          screen.x, screen.y, flashSize
        );
        flashGradient.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha})`);
        flashGradient.addColorStop(0.5, `rgba(255, 200, 0, ${flashAlpha * 0.5})`);
        flashGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

        this.ctx.fillStyle = flashGradient;
        this.ctx.fillRect(
          screen.x - flashSize,
          screen.y - flashSize,
          flashSize * 2,
          flashSize * 2
        );
      }

      // Update and draw particles
      for (const particle of explosion.particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1; // Gravity
        particle.life -= 0.02;
        particle.vx *= 0.98; // Air resistance

        if (particle.life <= 0) continue;

        const alpha = particle.life;
        const particleScreen = {
          x: screen.x + particle.x * this.cellSize / CELL_SIZE,
          y: screen.y + particle.y * this.cellSize / CELL_SIZE,
        };

        // Draw particle with trail
        this.ctx.fillStyle = particle.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        this.ctx.beginPath();
        this.ctx.arc(particleScreen.x, particleScreen.y, particle.size * (1 - progress * 0.5), 0, Math.PI * 2);
        this.ctx.fill();

        // Spark effect
        if (Math.random() < 0.3) {
          this.ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.5})`;
          this.ctx.beginPath();
          this.ctx.arc(
            particleScreen.x + (Math.random() - 0.5) * 4,
            particleScreen.y + (Math.random() - 0.5) * 4,
            1,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        }
      }
    }

    this.explosions = activeExplosions;
  }

  private drawRevealEffects() {
    const now = Date.now();
    const activeEffects: RevealEffect[] = [];

    for (const effect of this.revealEffects) {
      const elapsed = now - effect.startTime;
      if (elapsed >= effect.duration) continue;

      activeEffects.push(effect);
      const progress = elapsed / effect.duration;
      const intensity = effect.intensity;

      // Calculate center of revealed cells for ripple effect
      let centerX = 0;
      let centerY = 0;
      for (const cell of effect.cells) {
        centerX += cell.x;
        centerY += cell.y;
      }
      centerX /= effect.cells.length;
      centerY /= effect.cells.length;

      const centerScreen = this.worldToScreen(centerX + 0.5, centerY + 0.5);

      // Draw expanding ripple ring (intensity-based)
      if (intensity > 0.3) {
        const ringRadius = this.cellSize * (1 + progress * (2 + intensity * 3));
        const ringAlpha = (1 - progress) * 0.5 * intensity;

        this.ctx.strokeStyle = `rgba(100, 200, 255, ${ringAlpha})`;
        this.ctx.lineWidth = 2 + intensity * 2;
        this.ctx.beginPath();
        this.ctx.arc(centerScreen.x, centerScreen.y, ringRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Second ring for larger reveals
        if (intensity > 0.5) {
          const ring2Radius = this.cellSize * (0.5 + progress * (1.5 + intensity * 2));
          this.ctx.strokeStyle = `rgba(150, 230, 255, ${ringAlpha * 0.7})`;
          this.ctx.lineWidth = 1 + intensity;
          this.ctx.beginPath();
          this.ctx.arc(centerScreen.x, centerScreen.y, ring2Radius, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }

      // Draw glow on revealed cells - limit to max 30 cells for performance
      const maxGlowCells = 30;
      const cellsToGlow = effect.cells.length <= maxGlowCells
        ? effect.cells
        : effect.cells.filter((_, i) => i % Math.ceil(effect.cells.length / maxGlowCells) === 0);

      // Pre-calculate common values
      const glowAlpha = (1 - progress) * (0.3 + intensity * 0.4);
      const r = Math.floor(100 + intensity * 155);
      const g = Math.floor(200 + intensity * 55);
      const b = 255;
      const baseSize = this.cellSize - CELL_PADDING * 2;
      const glowSize = baseSize * (0.8 + intensity * 0.4);

      // Use simple rectangles with opacity instead of gradients for better performance
      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${glowAlpha * 0.6})`;

      for (const cell of cellsToGlow) {
        const screen = this.worldToScreen(cell.x, cell.y);
        const cellCenterX = screen.x + CELL_PADDING + baseSize / 2;
        const cellCenterY = screen.y + CELL_PADDING + baseSize / 2;

        this.ctx.fillRect(
          cellCenterX - glowSize * 0.5,
          cellCenterY - glowSize * 0.5,
          glowSize,
          glowSize
        );
      }

      // Sparkle effect - only for small reveals and limited count
      if (intensity > 0.4 && progress < 0.5 && effect.cells.length < 50) {
        const sparkleCount = Math.min(5, Math.floor(effect.cells.length * 0.1));
        this.ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress * 2) * 0.8})`;

        for (let i = 0; i < sparkleCount; i++) {
          const cell = effect.cells[Math.floor(Math.random() * effect.cells.length)];
          const screen = this.worldToScreen(cell.x, cell.y);
          const sparkleX = screen.x + CELL_PADDING + baseSize * Math.random();
          const sparkleY = screen.y + CELL_PADDING + baseSize * Math.random();
          const sparkleSize = 1 + Math.random() * 2;

          this.ctx.beginPath();
          this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // Flash effect at the beginning for large reveals (simplified for performance)
      if (intensity > 0.6 && progress < 0.15) {
        const flashAlpha = (0.15 - progress) / 0.15 * 0.25 * intensity;
        // Limit flash size to prevent huge draws
        const flashSize = Math.min(this.cellSize * 15, this.cellSize * Math.sqrt(effect.cells.length) * 1.5);

        // Simple rectangle with opacity instead of gradient for performance
        this.ctx.fillStyle = `rgba(180, 230, 255, ${flashAlpha})`;
        this.ctx.fillRect(
          centerScreen.x - flashSize,
          centerScreen.y - flashSize,
          flashSize * 2,
          flashSize * 2
        );
      }
    }

    this.revealEffects = activeEffects;
  }

  private drawScanHighlights(highlights: Position[]) {
    if (highlights.length === 0) return;

    const now = Date.now();
    const alpha = 0.5 + 0.3 * Math.sin(now / 200);

    this.ctx.fillStyle = `rgba(199, 84, 80, ${alpha})`;

    for (const pos of highlights) {
      const screen = this.worldToScreen(pos.x, pos.y);
      const size = this.cellSize - CELL_PADDING * 2;

      this.ctx.fillRect(
        screen.x + CELL_PADDING,
        screen.y + CELL_PADDING,
        size,
        size
      );
    }
  }

  private drawCursors(
    cursors: PlayerCursor[],
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) {
    for (const cursor of cursors) {
      const { x, y } = cursor.position;
      if (x < startX || x > endX || y < startY || y > endY) continue;

      const screen = this.worldToScreen(x, y);
      const size = this.cellSize;

      // Draw cursor highlight
      this.ctx.strokeStyle = cursor.color;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        screen.x + 2,
        screen.y + 2,
        size - 4,
        size - 4
      );

      // Draw player name
      this.ctx.fillStyle = cursor.color;
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        cursor.playerName.slice(0, 8),
        screen.x + size / 2,
        screen.y - 4
      );
    }
  }

  private drawTreasures(
    treasures: TreasureCell[],
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) {
    const now = Date.now();

    for (const treasure of treasures) {
      const { x, y } = treasure.position;

      // Skip if not in visible range
      if (x < startX || x > endX || y < startY || y > endY) continue;

      const screen = this.worldToScreen(x, y);
      const size = this.cellSize;
      const centerX = screen.x + size / 2;
      const centerY = screen.y + size / 2;

      // Calculate time-based animations
      const timeRemaining = treasure.expireTime - now;
      const totalDuration = treasure.expireTime - treasure.spawnTime;
      const remainingRatio = timeRemaining / totalDuration;

      // Pulsing animation - faster when expiring soon
      const pulseSpeed = remainingRatio < 0.3 ? 100 : 300;
      const pulse = Math.sin(now / pulseSpeed) * 0.3 + 1;

      // Floating animation
      const floatY = Math.sin(now / 500) * 3;

      // Treasure colors
      const colors: Record<string, { primary: string; secondary: string; glow: string }> = {
        gold: { primary: '#fbbf24', secondary: '#f59e0b', glow: '#fcd34d' },
        diamond: { primary: '#60a5fa', secondary: '#3b82f6', glow: '#93c5fd' },
        rainbow: { primary: '#f472b6', secondary: '#ec4899', glow: '#fbcfe8' },
      };

      const color = colors[treasure.type] || colors.gold;

      // Draw outer glow (larger when about to expire)
      const glowSize = size * (0.8 + pulse * 0.4) * (remainingRatio < 0.3 ? 1.5 : 1);
      const glowGradient = this.ctx.createRadialGradient(
        centerX, centerY + floatY, 0,
        centerX, centerY + floatY, glowSize
      );
      glowGradient.addColorStop(0, `${color.glow}80`);
      glowGradient.addColorStop(0.5, `${color.primary}40`);
      glowGradient.addColorStop(1, 'transparent');

      this.ctx.fillStyle = glowGradient;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY + floatY, glowSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw sparkle particles (fewer on mobile)
      const baseSparkles = treasure.type === 'rainbow' ? 8 : (treasure.type === 'diamond' ? 6 : 4);
      const sparkleCount = this.isMobile ? Math.ceil(baseSparkles / 2) : baseSparkles;
      for (let i = 0; i < sparkleCount; i++) {
        const sparkleAngle = (now / 1000 + i * (Math.PI * 2 / sparkleCount)) % (Math.PI * 2);
        const sparkleDistance = size * 0.4 * pulse;
        const sparkleX = centerX + Math.cos(sparkleAngle) * sparkleDistance;
        const sparkleY = centerY + floatY + Math.sin(sparkleAngle) * sparkleDistance;
        const sparkleSize = 2 + Math.sin(now / 200 + i) * 1;

        this.ctx.fillStyle = color.glow;
        this.ctx.beginPath();
        this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Rainbow treasure special effect - color cycling
      if (treasure.type === 'rainbow') {
        const hue = (now / 20) % 360;
        const rainbowGradient = this.ctx.createRadialGradient(
          centerX, centerY + floatY, 0,
          centerX, centerY + floatY, size * 0.5
        );
        rainbowGradient.addColorStop(0, `hsl(${hue}, 80%, 70%)`);
        rainbowGradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 80%, 60%)`);
        rainbowGradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 80%, 50%)`);

        this.ctx.fillStyle = rainbowGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + floatY, size * 0.35 * pulse, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Draw treasure body for gold/diamond
        const treasureGradient = this.ctx.createRadialGradient(
          centerX - size * 0.1, centerY + floatY - size * 0.1, 0,
          centerX, centerY + floatY, size * 0.35
        );
        treasureGradient.addColorStop(0, color.glow);
        treasureGradient.addColorStop(0.5, color.primary);
        treasureGradient.addColorStop(1, color.secondary);

        this.ctx.fillStyle = treasureGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + floatY, size * 0.3 * pulse, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Draw emoji
      const emoji = TREASURE.EMOJIS[treasure.type];
      this.ctx.font = `${size * 0.5 * pulse}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(emoji, centerX, centerY + floatY);

      // Draw highlight
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.beginPath();
      this.ctx.arc(
        centerX - size * 0.1,
        centerY + floatY - size * 0.1,
        size * 0.08,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Draw expiring indicator (progress ring)
      if (remainingRatio < 0.5) {
        const ringRadius = size * 0.45;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * remainingRatio * 2);

        // Background ring
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + floatY, ringRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Progress ring
        const urgencyColor = remainingRatio < 0.2 ? '#ef4444' : (remainingRatio < 0.35 ? '#f59e0b' : '#22c55e');
        this.ctx.strokeStyle = urgencyColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY + floatY, ringRadius, startAngle, endAngle);
        this.ctx.stroke();
      }

      // Draw reward preview on hover (if close to cell center)
      const rewardText = `+${treasure.reward}`;
      this.ctx.font = `bold ${size * 0.25}px Arial`;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 2;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.strokeText(rewardText, centerX, centerY + floatY + size * 0.35);
      this.ctx.fillText(rewardText, centerX, centerY + floatY + size * 0.35);
    }
  }

  private drawGrid(startX: number, startY: number, endX: number, endY: number) {
    // Light mono grid - visible but not intrusive
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = startX; x <= endX + 1; x++) {
      const screen = this.worldToScreen(x, startY);
      this.ctx.beginPath();
      this.ctx.moveTo(screen.x, screen.y);
      this.ctx.lineTo(screen.x, this.worldToScreen(x, endY + 1).y);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y <= endY + 1; y++) {
      const screen = this.worldToScreen(startX, y);
      this.ctx.beginPath();
      this.ctx.moveTo(screen.x, screen.y);
      this.ctx.lineTo(this.worldToScreen(endX + 1, y).x, screen.y);
      this.ctx.stroke();
    }
  }

  private drawZoneBorders() {
    const pulse = Math.sin(this.globalTime / 1000) * 0.3 + 0.7;

    for (const zone of ZONE_LAYOUT) {
      const start = this.worldToScreen(zone.bounds.startX, zone.bounds.startY);
      const end = this.worldToScreen(zone.bounds.endX, zone.bounds.endY);
      const color = ZONE_COLORS[zone.type].border;

      // Draw neon glow (outer)
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 15 * pulse;
      this.ctx.strokeStyle = color + '60';
      this.ctx.lineWidth = 4;
      this.ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);

      // Draw main border
      this.ctx.shadowBlur = 8 * pulse;
      this.ctx.strokeStyle = color + '90';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);

      // Reset shadow
      this.ctx.shadowBlur = 0;
    }
  }

  private adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  private drawBackground() {
    // Create light background with subtle blue-gray tint for contrast with UI
    const gradient = this.ctx.createLinearGradient(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // Slight blue-gray tint to distinguish from white UI panels
    gradient.addColorStop(0, '#f0f4f8');
    gradient.addColorStop(0.5, '#e8eef4');
    gradient.addColorStop(1, '#f0f4f8');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
