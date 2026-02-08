import { Component, ErrorInfo, ReactNode, useState, useCallback } from 'react';
import { GameCanvas } from '../Game/GameCanvas';
import { MiniMap } from '../Game/MiniMap';
import { Skillbar } from '../UI/Skillbar';
import { Inventory } from '../UI/Inventory';
import { Leaderboard } from '../UI/Leaderboard';
import { SessionInfo } from '../UI/SessionInfo';
import { Chat } from '../UI/Chat';
import { Notifications } from '../UI/Notifications';
import { Achievements } from '../UI/Achievements';
import { GuildPanel } from '../UI/GuildPanel';
import { Settings } from '../UI/Settings';
import { ComboDisplay } from '../UI/ComboDisplay';
import { SessionHistory } from '../UI/SessionHistory';
import { VirtualJoystick } from '../UI/VirtualJoystick';

// Error boundary to isolate component failures
class SafeWrapper extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SafeWrapper] Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

// Edge margin constant for alignment
const EDGE = 'p-4'; // 16px padding for all edges

export function GameLayout() {
  const [showChat, setShowChat] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Joystick pan handler - uses gameStore viewport directly
  const handleJoystickMove = useCallback((deltaX: number, deltaY: number) => {
    // Dispatch a custom event that useViewport can listen to
    window.dispatchEvent(new CustomEvent('joystick-move', { detail: { deltaX, deltaY } }));
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden bg-game-bg">
      {/* Background grid pattern */}
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />

      {/* Main game canvas */}
      <div className="absolute inset-0 z-0">
        <GameCanvas />
      </div>

      {/* Scan line overlay effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
        <div className="absolute inset-0 opacity-[0.02]"
             style={{
               backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
             }} />
      </div>

      {/* ===== FRAME CONTAINER - All UI aligned to this ===== */}
      <div className="absolute inset-0 p-3 sm:p-4 pointer-events-none z-10">
        {/* Corner decorations - at the edge */}
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-l-2 border-game-accent/30" />
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-r-2 border-game-accent/30" />
        <div className="hidden md:block absolute bottom-3 sm:bottom-4 left-3 sm:left-4 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-l-2 border-game-accent/30" />
        <div className="hidden md:block absolute bottom-3 sm:bottom-4 right-3 sm:right-4 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-r-2 border-game-accent/30" />

        {/* ===== TOP LEFT - Session & Leaderboard (desktop) ===== */}
        <div className="absolute top-6 sm:top-8 left-6 sm:left-8 space-y-2 w-[200px] sm:w-[240px] lg:w-[280px] pointer-events-auto">
          <SessionInfo />
          <div className="hidden md:block">
            <Leaderboard />
          </div>
        </div>

        {/* ===== TOP CENTER - Version Tag ===== */}
        <div className="absolute top-6 sm:top-8 left-1/2 -translate-x-1/2 pt-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-6 sm:w-12 h-px bg-gradient-to-r from-transparent to-game-border" />
            <span className="text-[8px] sm:text-[9px] text-game-text-muted font-mono uppercase tracking-widest whitespace-nowrap">
              OH MY MINES
            </span>
            <div className="w-6 sm:w-12 h-px bg-gradient-to-l from-transparent to-game-border" />
          </div>
        </div>

        {/* ===== TOP RIGHT - MiniMap & Buttons ===== */}
        <div className="absolute top-6 sm:top-8 right-6 sm:right-8 space-y-2 flex flex-col items-end w-[240px] sm:w-[280px] pointer-events-auto">
          <MiniMap />
          <div className="flex gap-1.5 w-full justify-between">
            <Achievements />
            <GuildPanel />
            <button
              onClick={() => setShowHistory(true)}
              className="flex-1 py-1.5 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider bg-game-primary/90 border border-game-border hover:border-game-accent/50 hover:bg-game-accent/10 transition-colors text-game-text-muted"
              style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
            >
              Archive
            </button>
            <Settings />
          </div>
        </div>

        {/* ===== BOTTOM LEFT - Chat (desktop only) ===== */}
        <div className="hidden md:block absolute bottom-6 sm:bottom-8 left-6 sm:left-8 w-[220px] sm:w-[260px] lg:w-[300px] pointer-events-auto">
          <Chat />
        </div>

        {/* ===== BOTTOM CENTER - Inventory & Skillbar ===== */}
        {/* Desktop: centered above bottom edge */}
        <div className="hidden md:flex absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 pointer-events-auto flex-col items-center gap-2 sm:gap-2.5">
          <Inventory />
          <Skillbar />
        </div>

        {/* Mobile: skillbar fixed at bottom */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 pointer-events-auto mobile-bottom-bar">
          <div className="flex flex-col items-center gap-1 pb-safe px-2 pt-1">
            <Inventory />
            <Skillbar />
          </div>
        </div>

        {/* ===== BOTTOM RIGHT - Help (desktop only) ===== */}
        <div className="absolute bottom-6 sm:bottom-8 right-6 sm:right-8 pointer-events-none">
          <div className="hidden lg:block text-[9px] text-game-text-muted text-right space-y-0.5 font-mono">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-game-accent">[LMB]</span> Reveal
              <span className="text-game-border">|</span>
              <span className="text-game-accent">[RMB]</span> Flag
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-game-accent">[WASD]</span> Move
              <span className="text-game-border">|</span>
              <span className="text-game-accent">[1-6]</span> Skills
            </div>
          </div>
        </div>
      </div>

      {/* ===== MOBILE FLOATING BUTTONS ===== */}
      <div className="md:hidden fixed bottom-20 right-3 z-20 flex flex-col gap-2 pointer-events-auto mobile-fab-group">
        {/* Chat toggle */}
        <button
          className="mobile-fab"
          onClick={() => { setShowChat(!showChat); setShowLeaderboard(false); setShowInventory(false); }}
          aria-label="Toggle chat"
        >
          <span className="text-sm">💬</span>
        </button>

        {/* Leaderboard toggle */}
        <button
          className="mobile-fab"
          onClick={() => { setShowLeaderboard(!showLeaderboard); setShowChat(false); setShowInventory(false); }}
          aria-label="Toggle leaderboard"
        >
          <span className="text-sm">🏆</span>
        </button>
      </div>

      {/* ===== MOBILE OVERLAYS ===== */}
      {/* Chat overlay */}
      {showChat && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setShowChat(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div
            className="mobile-slide-up pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-slide-up-handle" />
            <div className="max-h-[60vh] overflow-hidden">
              <Chat />
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard overlay */}
      {showLeaderboard && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setShowLeaderboard(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          <div
            className="mobile-slide-up pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-slide-up-handle" />
            <div className="max-h-[60vh] overflow-hidden">
              <Leaderboard />
            </div>
          </div>
        </div>
      )}

      {/* Virtual Joystick - mobile only */}
      <div className="virtual-joystick-wrapper pointer-events-auto">
        <VirtualJoystick onMove={handleJoystickMove} />
      </div>

      {/* Session History Modal */}
      <SafeWrapper>
        <SessionHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />
      </SafeWrapper>

      {/* Notifications - positioned outside frame, slides in from right */}
      <Notifications />

      {/* Combo display (top center, below version tag) */}
      <SafeWrapper>
        <ComboDisplay />
      </SafeWrapper>
    </div>
  );
}
