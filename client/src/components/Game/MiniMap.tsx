import { useRef, useEffect, useMemo, useState } from 'react';
import { MAP_WIDTH, MAP_HEIGHT, RENDER, ZONE_COLORS, ZONE_LAYOUT, CHUNK_SIZE } from 'shared';
import { useGameStore } from '../../stores/gameStore';

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportCenter = useGameStore((s) => s.viewportCenter);
  const zoom = useGameStore((s) => s.zoom);
  const chunks = useGameStore((s) => s.chunks);
  const session = useGameStore((s) => s.session);
  const visibleCells = useGameStore((s) => s.visibleCells);
  const treasures = useGameStore((s) => s.treasures);
  const [, setTick] = useState(0);

  // Update for treasure animation
  useEffect(() => {
    if (treasures.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, [treasures.length]);

  // Calculate progress stats
  const stats = useMemo(() => {
    let revealedCount = 0;
    let flaggedCount = 0;
    let mineCount = 0;

    for (const cell of visibleCells.values()) {
      if (cell.state === 'revealed') revealedCount++;
      if (cell.state === 'flagged') flaggedCount++;
      if (cell.isMine && cell.state === 'revealed') mineCount++;
    }

    const totalCells = session?.totalCells ?? MAP_WIDTH * MAP_HEIGHT;
    const totalMines = session?.totalMines ?? 0;
    const minesExploded = session?.minesExploded ?? mineCount;

    return {
      revealedCount: session?.cellsRevealed ?? revealedCount,
      totalCells,
      revealedPercent: ((session?.cellsRevealed ?? revealedCount) / totalCells * 100).toFixed(1),
      minesExploded,
      totalMines,
      minePercent: totalMines > 0 ? (minesExploded / totalMines * 100).toFixed(1) : '0',
      flaggedCount,
    };
  }, [visibleCells, session]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = RENDER.MINIMAP_SIZE;
    const scale = size / MAP_WIDTH;

    // Clear with light background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, size, size);

    // Draw contour-like zone background
    for (const zone of ZONE_LAYOUT) {
      ctx.fillStyle = ZONE_COLORS[zone.type].bg;
      ctx.fillRect(
        zone.bounds.startX * scale,
        zone.bounds.startY * scale,
        (zone.bounds.endX - zone.bounds.startX) * scale,
        (zone.bounds.endY - zone.bounds.startY) * scale
      );

      // Zone border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(
        zone.bounds.startX * scale,
        zone.bounds.startY * scale,
        (zone.bounds.endX - zone.bounds.startX) * scale,
        (zone.bounds.endY - zone.bounds.startY) * scale
      );
    }

    // Draw chunk grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 0.5;
    for (let cx = 0; cx <= MAP_WIDTH / CHUNK_SIZE; cx++) {
      ctx.beginPath();
      ctx.moveTo(cx * CHUNK_SIZE * scale, 0);
      ctx.lineTo(cx * CHUNK_SIZE * scale, size);
      ctx.stroke();
    }
    for (let cy = 0; cy <= MAP_HEIGHT / CHUNK_SIZE; cy++) {
      ctx.beginPath();
      ctx.moveTo(0, cy * CHUNK_SIZE * scale);
      ctx.lineTo(size, cy * CHUNK_SIZE * scale);
      ctx.stroke();
    }

    // Draw revealed chunks with gradient based on progress
    for (const chunk of chunks.values()) {
      if (chunk.revealedCount > 0) {
        const progress = chunk.revealedCount / (CHUNK_SIZE * CHUNK_SIZE);

        // Dark gradient for revealed areas on light background
        const intensity = Math.floor(80 + 100 * progress);
        const alpha = 0.1 + progress * 0.3;

        ctx.fillStyle = `rgba(${intensity}, ${intensity}, ${intensity}, ${alpha})`;
        ctx.fillRect(
          chunk.coord.cx * CHUNK_SIZE * scale,
          chunk.coord.cy * CHUNK_SIZE * scale,
          CHUNK_SIZE * scale,
          CHUNK_SIZE * scale
        );

        // Completion indicator
        if (progress > 0.95) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.font = `${Math.floor(CHUNK_SIZE * scale * 0.4)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            '+',
            (chunk.coord.cx + 0.5) * CHUNK_SIZE * scale,
            (chunk.coord.cy + 0.5) * CHUNK_SIZE * scale
          );
        }
      }
    }

    // Draw mine explosion markers
    ctx.fillStyle = '#e74c3c';
    for (const cell of visibleCells.values()) {
      if (cell.isMine && cell.state === 'revealed') {
        const x = cell.x * scale;
        const y = cell.y * scale;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw treasure markers with pulsing effect
    const now = Date.now();
    for (const treasure of treasures) {
      const x = treasure.position.x * scale;
      const y = treasure.position.y * scale;
      const pulse = Math.sin(now / 200) * 0.5 + 1.5;

      const colors = {
        gold: '#fbbf24',
        diamond: '#60a5fa',
        rainbow: '#f472b6',
      };

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 6 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `${colors[treasure.type]}40`;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = colors[treasure.type];
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw viewport indicator
    const viewWidth = (window.innerWidth / (24 * zoom)) * scale;
    const viewHeight = (window.innerHeight / (24 * zoom)) * scale;
    const viewX = viewportCenter.x * scale - viewWidth / 2;
    const viewY = viewportCenter.y * scale - viewHeight / 2;

    // Viewport fill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(viewX, viewY, viewWidth, viewHeight);

    // Viewport border with corner cuts look
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewX, viewY, viewWidth, viewHeight);

    // Draw current position dot
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(viewportCenter.x * scale, viewportCenter.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    // Crosshair at center
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    const cx = viewportCenter.x * scale;
    const cy = viewportCenter.y * scale;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy);
    ctx.lineTo(cx - 2, cy);
    ctx.moveTo(cx + 2, cy);
    ctx.lineTo(cx + 6, cy);
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx, cy - 2);
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx, cy + 6);
    ctx.stroke();

    // Border frame
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    // Corner accents
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(size, size - 12);
    ctx.lineTo(size, size);
    ctx.lineTo(size - 12, size);
    ctx.stroke();
  }, [viewportCenter, zoom, chunks, visibleCells, treasures]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scale = RENDER.MINIMAP_SIZE / MAP_WIDTH;
    const worldX = Math.floor(x / scale);
    const worldY = Math.floor(y / scale);

    useGameStore.getState().navigateTo({ x: worldX, y: worldY });
  };

  return (
    <div className="game-panel corner-cut-md w-full">
      <div className="game-panel-header text-[9px] sm:text-[10px]">Map</div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={RENDER.MINIMAP_SIZE}
          height={RENDER.MINIMAP_SIZE}
          className="cursor-pointer w-full h-auto"
          style={{ maxWidth: RENDER.MINIMAP_SIZE }}
          onClick={handleClick}
        />
        {/* Coordinate display */}
        <div className="absolute bottom-2 right-2 coord-display">
          <span className="coord-icon" />
          <span className="coord-x">{Math.floor(viewportCenter.x)}</span>
          <span className="coord-separator">,</span>
          <span className="coord-y">{Math.floor(viewportCenter.y)}</span>
        </div>
      </div>

      {/* Progress Stats - hidden on very small screens */}
      <div className="hidden sm:block mt-3 space-y-2.5 text-xs">
        {/* Revealed Progress */}
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-game-text-muted uppercase tracking-wider flex items-center gap-1">
              <span className="w-1 h-1 bg-game-info rotate-45" />
              Explored
            </span>
            <span className="text-game-text-dim font-mono">{stats.revealedPercent}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, parseFloat(stats.revealedPercent))}%` }}
            />
          </div>
        </div>

        {/* Mine Explosion Progress */}
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-game-text-muted uppercase tracking-wider flex items-center gap-1">
              <span className="w-1 h-1 bg-game-danger rotate-45" />
              Detonated
            </span>
            <span className="text-game-text-dim font-mono">{stats.minesExploded}/{stats.totalMines}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill danger"
              style={{ width: `${Math.min(100, parseFloat(stats.minePercent))}%` }}
            />
          </div>
        </div>

        {/* Treasure indicator */}
        {treasures.length > 0 && (
          <div className="flex items-center justify-between py-1.5 px-2 -mx-2 bg-game-accent/10 border-l-2 border-l-game-accent">
            <span className="text-game-accent text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-game-accent animate-pulse" />
              {treasures.length} Treasure{treasures.length > 1 ? 's' : ''} Detected
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-game-border text-[9px] text-game-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-game-accent/40" /> Explored
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-game-danger" /> Explosion
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-game-accent" /> Position
          </span>
        </div>
      </div>
    </div>
  );
}
