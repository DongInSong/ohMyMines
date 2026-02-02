import { useState, useCallback, useEffect, useRef } from 'react';
import { PLAYER_COLORS } from 'shared';
import { useGame } from '../hooks/useGame';
import { usePlayerStore } from '../stores/playerStore';
import { useGameStore } from '../stores/gameStore';
import { soundManager } from '../utils/SoundManager';

// Reset confirmation dialog - Tactical style
function ResetConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-game-danger/20 border border-game-danger/50"
               style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
            <span className="text-game-danger text-xl">!</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-game-text">SYSTEM RESET</h3>
            <p className="text-[10px] text-game-text-muted uppercase tracking-wider">Data Purge Protocol</p>
          </div>
        </div>

        <p className="text-game-text-dim text-sm mb-4">
          This will permanently delete all stored data:
        </p>
        <ul className="text-game-text-muted text-xs mb-4 space-y-1 pl-4">
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 bg-game-accent rotate-45"></span>
            Agent identity and color
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 bg-game-accent rotate-45"></span>
            Achievement progress
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 bg-game-accent rotate-45"></span>
            Cumulative score and mission count
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1 h-1 bg-game-accent rotate-45"></span>
            System preferences
          </li>
        </ul>

        <div className="p-3 bg-game-danger/10 border border-game-danger/30 mb-6">
          <p className="text-game-danger text-xs font-semibold uppercase tracking-wider">
            Warning: This action is irreversible
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="game-button secondary flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} className="game-button danger flex-1">
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// Contour line SVG component
function ContourLines() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="contour" width="200" height="200" patternUnits="userSpaceOnUse">
          <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(0, 0, 0, 0.03)" strokeWidth="1"/>
          <circle cx="100" cy="100" r="50" fill="none" stroke="rgba(0, 0, 0, 0.025)" strokeWidth="1"/>
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(0, 0, 0, 0.02)" strokeWidth="1"/>
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(0, 0, 0, 0.015)" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#contour)"/>
    </svg>
  );
}

// Floating particle for background
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  char: string;
}

// Neon wave effect for background
interface NeonWave {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  color: string;
  speed: number;
}

export function LoginScreen() {
  const savedName = usePlayerStore((s) => s.savedName);
  const savedColor = usePlayerStore((s) => s.savedColor);
  const totalScore = usePlayerStore((s) => s.totalScore);
  const gamesPlayed = usePlayerStore((s) => s.gamesPlayed);
  const resetAllData = usePlayerStore((s) => s.resetAllData);
  const isConnected = useGameStore((s) => s.isConnected);

  const [name, setName] = useState(savedName || '');
  const [color, setColor] = useState(
    savedColor || PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]
  );
  const [isHovering, setIsHovering] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wavesRef = useRef<NeonWave[]>([]);
  const animationRef = useRef<number>();

  const { startGame } = useGame();

  const handleResetData = useCallback(() => {
    resetAllData();
    setShowResetDialog(false);
    window.location.reload();
  }, [resetAllData]);

  // Initialize particles
  useEffect(() => {
    const chars = ['0', '1', '/', '\\', '|', '-', '+', '*', '.', ':'];
    const newParticles: Particle[] = [];
    for (let i = 0; i < 40; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 10 + Math.random() * 12,
        speed: 0.015 + Math.random() * 0.025,
        opacity: 0.02 + Math.random() * 0.05,
        char: chars[Math.floor(Math.random() * chars.length)],
      });
    }
    setParticles(newParticles);

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          y: p.y - p.speed < -5 ? 105 : p.y - p.speed,
        }))
      );
    }, 50);

    setTimeout(() => setShowContent(true), 300);

    return () => clearInterval(interval);
  }, []);

  // Draw tactical grid background with neon waves
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = 40;
    const waveColors = ['#00ffff', '#ff00ff', '#00ff88', '#ffff00', '#ff6b6b', '#6b6bff'];

    // Pre-generate static elements
    let accentCells: { x: number; y: number }[] = [];
    let cornerMarkers: { x: number; y: number }[] = [];

    const regenerateStatic = () => {
      const cols = Math.ceil(canvas.width / cellSize) + 1;
      const rows = Math.ceil(canvas.height / cellSize) + 1;

      accentCells = [];
      for (let i = 0; i < 25; i++) {
        accentCells.push({
          x: Math.floor(Math.random() * cols) * cellSize,
          y: Math.floor(Math.random() * rows) * cellSize,
        });
      }

      cornerMarkers = [];
      for (let i = 0; i < 8; i++) {
        cornerMarkers.push({
          x: Math.floor(Math.random() * cols) * cellSize,
          y: Math.floor(Math.random() * rows) * cellSize,
        });
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      regenerateStatic();
    };

    const triggerWave = () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const color = waveColors[Math.floor(Math.random() * waveColors.length)];

      wavesRef.current.push({
        x,
        y,
        startTime: Date.now(),
        duration: 1200,
        color,
        speed: 150,
      });

      // Limit max waves
      if (wavesRef.current.length > 3) {
        wavesRef.current.shift();
      }
    };

    const drawFrame = () => {
      const now = Date.now();

      // Clear and fill background
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.ceil(canvas.width / cellSize) + 1;
      const rows = Math.ceil(canvas.height / cellSize) + 1;

      // Draw wave glows on cells
      for (const wave of wavesRef.current) {
        const elapsed = now - wave.startTime;
        if (elapsed >= wave.duration) continue;

        const progress = elapsed / wave.duration;
        const waveRadius = (elapsed / 1000) * wave.speed;
        const waveThickness = 60;

        // Smooth fade out using ease-out curve (starts strong, fades smoothly to 0)
        const fadeOut = 1 - Math.pow(progress, 0.5);

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const cellX = col * cellSize + cellSize / 2;
            const cellY = row * cellSize + cellSize / 2;

            const dx = cellX - wave.x;
            const dy = cellY - wave.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const distFromWave = Math.abs(dist - waveRadius);

            if (distFromWave < waveThickness) {
              const waveIntensity = 1 - distFromWave / waveThickness;
              const intensity = waveIntensity * fadeOut;
              const alpha = Math.floor(intensity * 200).toString(16).padStart(2, '0');

              ctx.fillStyle = `${wave.color}${alpha}`;
              ctx.fillRect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2);
            }
          }
        }
      }

      // Clean up expired waves
      wavesRef.current = wavesRef.current.filter(w => now - w.startTime < w.duration);

      // Draw main grid
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, canvas.height);
        ctx.stroke();
      }

      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
      }

      // Draw accent cells
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      for (const cell of accentCells) {
        ctx.fillRect(cell.x + 1, cell.y + 1, cellSize - 2, cellSize - 2);
      }

      // Draw corner markers
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 2;
      for (const marker of cornerMarkers) {
        ctx.beginPath();
        ctx.moveTo(marker.x, marker.y + 8);
        ctx.lineTo(marker.x, marker.y);
        ctx.lineTo(marker.x + 8, marker.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(marker.x + cellSize, marker.y + cellSize - 8);
        ctx.lineTo(marker.x + cellSize, marker.y + cellSize);
        ctx.lineTo(marker.x + cellSize - 8, marker.y + cellSize);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    resize();
    window.addEventListener('resize', resize);

    // Start animation
    drawFrame();

    // Trigger waves randomly every 2-4 seconds
    const waveInterval = setInterval(() => {
      triggerWave();
    }, 2000 + Math.random() * 2000);

    // Trigger first wave after 500ms
    setTimeout(triggerWave, 500);

    return () => {
      window.removeEventListener('resize', resize);
      clearInterval(waveInterval);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !isConnected) return;
      soundManager.play('skill');
      startGame(name.trim(), color);
    },
    [name, color, isConnected, startGame]
  );

  const handleColorSelect = (c: string) => {
    setColor(c);
    soundManager.play('reveal');
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-game-bg">
      {/* Grid canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Contour lines overlay */}
      <ContourLines />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute font-mono text-game-accent transition-all duration-1000"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              transform: `rotate(${p.id * 12}deg)`,
            }}
          >
            {p.char}
          </div>
        ))}
      </div>

      {/* Subtle gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-game-bg/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-game-bg/20" />

      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
             style={{
               backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)',
             }} />
      </div>

      {/* Main content */}
      <div className={`relative z-10 w-full h-full flex flex-col items-center justify-center transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Logo section */}
        <div className="mb-12 text-center">
          {/* Top decorative element */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-game-accent/50 to-transparent" />
            <div className="relative">
              <div className="w-3 h-3 bg-game-accent rotate-45" />
              <div className="absolute inset-0 w-3 h-3 bg-game-accent rotate-45 animate-ping opacity-30" />
            </div>
            <div className="w-20 h-px bg-gradient-to-l from-transparent via-game-accent/50 to-transparent" />
          </div>

          {/* Title */}
          <div className="relative">
            <h1 className="text-7xl font-black tracking-tighter mb-1 font-display">
              <span className="text-game-text">OH MY</span>
              <span className="text-accent-gradient"> MINES</span>
            </h1>
            {/* Glowing underline */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-48 h-0.5 bg-gradient-to-r from-transparent via-game-accent to-transparent" />
          </div>

          {/* Subtitle with tactical tag style */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="tactical-tag">
              Tactical
            </div>
            <span className="text-game-text-muted text-xs">//</span>
            <p className="text-game-text-muted tracking-[0.3em] text-xs uppercase">
              Massive Multiplayer Minesweeper
            </p>
            <span className="text-game-text-muted text-xs">//</span>
            <div className="tactical-tag">
              Online
            </div>
          </div>

          {/* Bottom decorative line */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="w-32 h-px bg-gradient-to-r from-transparent to-game-border" />
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-game-text-muted rotate-45" />
              <div className="w-1 h-1 bg-game-text-muted rotate-45" />
              <div className="w-1 h-1 bg-game-text-muted rotate-45" />
            </div>
            <div className="w-32 h-px bg-gradient-to-l from-transparent to-game-border" />
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="w-full max-w-md px-6">
          {/* Name input */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-[10px] text-game-accent uppercase tracking-[0.2em] mb-3 font-semibold">
              <span className="w-1 h-1 bg-game-accent rotate-45" />
              Agent Callsign
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter designation..."
                maxLength={20}
                className="w-full bg-white/80 border border-game-border focus:border-game-accent
                         text-game-text text-xl py-4 px-4 outline-none transition-all duration-300
                         placeholder:text-game-text-muted/50"
                style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
                autoFocus
              />
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-game-accent/50" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-game-accent/50" />
              {/* Input glow when filled */}
              {name && (
                <div className="absolute inset-0 pointer-events-none"
                     style={{
                       boxShadow: '0 0 20px rgba(0, 0, 0, 0.05)',
                       clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)'
                     }} />
              )}
            </div>
          </div>

          {/* Color picker */}
          <div className="mb-8">
            <label className="flex items-center gap-2 text-[10px] text-game-accent uppercase tracking-[0.2em] mb-3 font-semibold">
              <span className="w-1 h-1 bg-game-accent rotate-45" />
              Identity Marker
            </label>
            <div className="flex justify-center gap-3">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`relative w-11 h-11 transition-all duration-200 ${
                    color === c
                      ? 'scale-110'
                      : 'opacity-40 hover:opacity-70 hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: c,
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  }}
                  onClick={() => handleColorSelect(c)}
                >
                  {color === c && (
                    <>
                      <div className="absolute inset-0 animate-ping opacity-30"
                           style={{
                             backgroundColor: c,
                             clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                           }} />
                      <div className="absolute -inset-1 border-2 opacity-60"
                           style={{
                             borderColor: c,
                             clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                           }} />
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Connection status */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px flex-1 bg-game-border" />
            <div className="flex items-center gap-2 px-4">
              <div className={`status-dot ${isConnected ? 'online' : 'danger'}`} />
              <span className="text-[10px] text-game-text-muted uppercase tracking-wider font-semibold">
                {isConnected ? 'Server Connected' : 'Establishing Link...'}
              </span>
            </div>
            <div className="h-px flex-1 bg-game-border" />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!name.trim() || !isConnected}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className={`relative w-full py-5 text-lg font-bold uppercase tracking-[0.2em]
                       transition-all duration-300 overflow-hidden group
                       ${!name.trim() || !isConnected
                         ? 'bg-game-tertiary text-game-text-muted cursor-not-allowed border border-game-border'
                         : 'bg-gradient-to-r from-game-accent to-game-accent-dim text-game-bg hover:shadow-glow-accent'}`}
            style={{
              clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
            }}
          >
            {/* Button shine effect */}
            <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent
                            -translate-x-full transition-transform duration-700
                            ${isHovering && name.trim() && isConnected ? 'translate-x-full' : ''}`} />

            <span className="relative z-10 flex items-center justify-center gap-3">
              <span>Deploy Agent</span>
              <svg className={`w-5 h-5 transition-transform duration-300 ${isHovering && name.trim() && isConnected ? 'translate-x-2' : ''}`}
                   fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/50" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/50" />
          </button>
        </form>

        {/* Returning player stats */}
        {savedName && gamesPlayed > 0 && (
          <div className={`mt-10 transition-all duration-500 delay-300 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
            <div className="text-[10px] text-game-accent uppercase tracking-[0.2em] mb-4 text-center font-semibold">
              // Welcome Back, Agent //
            </div>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-game-accent font-bold text-2xl font-mono">{totalScore.toLocaleString()}</div>
                <div className="text-game-text-muted text-[10px] uppercase tracking-wider mt-1">Total Score</div>
              </div>
              <div className="w-px h-12 bg-gradient-to-b from-transparent via-game-border to-transparent" />
              <div className="text-center">
                <div className="text-game-text font-bold text-2xl font-mono">{gamesPlayed}</div>
                <div className="text-game-text-muted text-[10px] uppercase tracking-wider mt-1">Missions</div>
              </div>
            </div>
          </div>
        )}

        {/* Controls hint */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 text-xs
                        transition-all duration-500 delay-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-2 text-game-text-muted">
            <kbd className="px-2 py-1 bg-game-primary border border-game-border text-game-text-dim font-mono text-[10px]"
                 style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}>
              LMB
            </kbd>
            <span>Reveal</span>
          </div>
          <span className="text-game-border">|</span>
          <div className="flex items-center gap-2 text-game-text-muted">
            <kbd className="px-2 py-1 bg-game-primary border border-game-border text-game-text-dim font-mono text-[10px]"
                 style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}>
              RMB
            </kbd>
            <span>Flag</span>
          </div>
          <span className="text-game-border">|</span>
          <div className="flex items-center gap-2 text-game-text-muted">
            <kbd className="px-2 py-1 bg-game-primary border border-game-border text-game-text-dim font-mono text-[10px]"
                 style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}>
              1-6
            </kbd>
            <span>Skills</span>
          </div>
        </div>

        {/* Version */}
        <div className="absolute bottom-4 right-4 text-[10px] text-game-text-muted font-mono">
          v1.0.0 // ENDFIELD
        </div>

        {/* Credits and Reset Data */}
        <div className="absolute bottom-4 left-4 flex items-center gap-3">
          <span className="text-[10px] text-game-text-muted font-mono">2024 // OH MY MINES</span>
          {(savedName || gamesPlayed > 0) && (
            <>
              <span className="text-game-border">|</span>
              <button
                onClick={() => setShowResetDialog(true)}
                className="text-[10px] text-game-text-muted hover:text-game-danger transition-colors font-mono"
              >
                [RESET DATA]
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reset confirmation dialog */}
      <ResetConfirmDialog
        isOpen={showResetDialog}
        onConfirm={handleResetData}
        onCancel={() => setShowResetDialog(false)}
      />
    </div>
  );
}
