import { useGameStore } from '../../stores/gameStore';
import { usePlayerStore } from '../../stores/playerStore';
import { SESSION } from 'shared';

function TotalScoreDisplay() {
  const totalScore = usePlayerStore((s) => s.totalScore);
  const gamesPlayed = usePlayerStore((s) => s.gamesPlayed);

  if (totalScore === 0 && gamesPlayed === 0) return null;

  return (
    <div className="mt-2 flex items-center gap-3 text-[10px] text-game-text-muted">
      <span className="font-mono">Total: {totalScore.toLocaleString()}</span>
      <span className="text-game-border">|</span>
      <span className="font-mono">Games: {gamesPlayed}</span>
    </div>
  );
}

export function SessionInfo() {
  const session = useGameStore((s) => s.session);
  const isConnected = useGameStore((s) => s.isConnected);
  const player = usePlayerStore((s) => s.player);

  if (!session) {
    return (
      <div className="game-panel corner-cut-md">
        <div className="flex items-center gap-3">
          <div className={`status-dot ${isConnected ? 'online' : 'danger'}`} />
          <span className="text-[10px] text-game-accent uppercase tracking-[0.15em] font-semibold">
            {isConnected ? 'Initializing...' : 'Connecting...'}
          </span>
        </div>
      </div>
    );
  }

  const revealProgress = session.totalCells > 0
    ? ((session.cellsRevealed / session.totalCells) * 100).toFixed(1)
    : '0.0';

  const mineProgress = session.totalMines > 0
    ? ((session.minesExploded / session.totalMines) * 100).toFixed(1)
    : '0.0';

  const mineThreshold = SESSION.MINES_EXPLODED_THRESHOLD * 100;
  const isMineDanger = parseFloat(mineProgress) > mineThreshold * 0.7;

  return (
    <div className="game-panel corner-cut-md w-full">
      {/* Header with connection */}
      <div className="flex items-center justify-between mb-4">
        <div className="game-panel-header mb-0">Session</div>
        <div className="flex items-center gap-2">
          <div className={`status-dot ${isConnected ? 'online' : 'danger'}`} />
          <span className="text-[10px] text-game-text-muted font-mono">{session.playerCount}</span>
        </div>
      </div>

      {/* Player Score */}
      {player && (
        <div className="mb-5 relative">
          {/* Score display */}
          <div className="flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-game-text tracking-tight font-mono">
              {player.score.toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-1 h-1 bg-game-accent rotate-45" />
            <span className="text-[10px] text-game-accent uppercase tracking-[0.15em] font-semibold">Session Score</span>
          </div>
          {/* Total Score */}
          <TotalScoreDisplay />
          {/* Decorative line */}
          <div className="absolute -bottom-2 left-0 w-full h-px bg-gradient-to-r from-game-accent/30 via-game-border to-transparent" />
        </div>
      )}

      {/* Progress bars */}
      <div className="space-y-4 mt-4">
        {/* Map Progress */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] text-game-text-muted uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
              <span className="w-1 h-1 bg-game-info rotate-45" />
              Explored
            </span>
            <span className="text-xs text-game-text-dim font-mono">{revealProgress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, parseFloat(revealProgress))}%` }}
            />
          </div>
        </div>

        {/* Mine Explosions */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] text-game-text-muted uppercase tracking-[0.15em] font-semibold flex items-center gap-1.5">
              <span className={`w-1 h-1 rotate-45 ${isMineDanger ? 'bg-game-danger' : 'bg-game-accent'}`} />
              Mine Threshold
            </span>
            <span className={`text-xs font-mono ${isMineDanger ? 'text-game-danger' : 'text-game-text-dim'}`}>
              {mineProgress}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-bar-fill ${isMineDanger ? 'danger' : ''}`}
              style={{ width: `${Math.min(100, (parseFloat(mineProgress) / mineThreshold) * 100)}%` }}
            />
          </div>
          {isMineDanger && (
            <div className="mt-1.5 text-[9px] text-game-danger uppercase tracking-wider animate-pulse">
              Warning: Critical threshold approaching
            </div>
          )}
        </div>
      </div>

      {/* Session State */}
      {session.state !== 'active' && (
        <div className={`mt-4 py-2 px-3 text-center text-[10px] uppercase tracking-[0.15em] font-semibold ${
          session.state === 'ending'
            ? 'bg-game-accent/10 border border-game-accent/30 text-game-accent'
            : 'bg-game-primary border border-game-border text-game-text-muted'
        }`}
        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}>
          {session.state === 'waiting' && '// Awaiting Players //'}
          {session.state === 'ending' && '// Session Ending //'}
          {session.state === 'finished' && '// Mission Complete //'}
        </div>
      )}
    </div>
  );
}
