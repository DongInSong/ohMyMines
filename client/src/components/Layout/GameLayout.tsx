import { Component, ErrorInfo, ReactNode } from 'react';
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
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-l-2 border-game-accent/30" />
        <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-r-2 border-game-accent/30" />

        {/* ===== TOP LEFT - Session & Leaderboard ===== */}
        <div className="absolute top-6 sm:top-8 left-6 sm:left-8 space-y-2 w-[200px] sm:w-[240px] lg:w-[280px] pointer-events-auto">
          <SessionInfo />
          <Leaderboard />
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
            <Settings />
          </div>
        </div>

        {/* ===== BOTTOM LEFT - Chat ===== */}
        <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-8 w-[220px] sm:w-[260px] lg:w-[300px] pointer-events-auto">
          <Chat />
        </div>

        {/* ===== BOTTOM CENTER - Inventory & Skillbar ===== */}
        <div className="absolute bottom-14 sm:bottom-16 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-2 sm:gap-2.5">
          <Inventory />
          <Skillbar />
        </div>

        {/* ===== BOTTOM RIGHT - Help ===== */}
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

      {/* Notifications - positioned outside frame, slides in from right */}
      <Notifications />

      {/* Combo display (top center, below version tag) */}
      <SafeWrapper>
        <ComboDisplay />
      </SafeWrapper>
    </div>
  );
}
