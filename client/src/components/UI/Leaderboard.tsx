import { useGameStore } from '../../stores/gameStore';
import { usePlayerStore } from '../../stores/playerStore';

export function Leaderboard() {
  const leaderboard = useGameStore((s) => s.leaderboard);
  const player = usePlayerStore((s) => s.player);

  return (
    <div className="game-panel corner-cut-md w-full max-h-60 sm:max-h-72 lg:max-h-80 overflow-hidden flex flex-col">
      <div className="game-panel-header">Leaderboard</div>

      {leaderboard.length === 0 ? (
        <div className="text-xs text-game-text-muted flex items-center gap-2">
          <div className="w-2 h-2 border border-game-accent/30 animate-pulse" />
          Awaiting data...
        </div>
      ) : (
        <div className="space-y-0.5 overflow-y-auto flex-1 -mr-2 pr-2">
          {leaderboard.slice(0, 10).map((entry) => {
            const isSelf = player?.id === entry.playerId;
            const isTop3 = entry.rank <= 3;

            return (
              <div
                key={entry.playerId}
                className={`
                  flex items-center gap-2 py-2 px-2.5 -mx-2 transition-all duration-150
                  border-l-2 group
                  ${isSelf
                    ? 'bg-game-accent/10 border-l-game-accent'
                    : 'border-l-transparent hover:bg-black/[0.02] hover:border-l-game-border-light'}
                `}
              >
                {/* Rank */}
                <div className={`
                  w-6 h-6 flex items-center justify-center text-xs font-bold font-mono
                  ${entry.rank === 1 ? 'text-yellow-400' : ''}
                  ${entry.rank === 2 ? 'text-gray-300' : ''}
                  ${entry.rank === 3 ? 'text-orange-400' : ''}
                  ${!isTop3 ? 'text-game-text-muted' : ''}
                `}
                style={isTop3 ? {
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  background: entry.rank === 1
                    ? 'rgba(250, 204, 21, 0.15)'
                    : entry.rank === 2
                      ? 'rgba(192, 192, 192, 0.15)'
                      : 'rgba(251, 146, 60, 0.15)',
                  border: `1px solid ${
                    entry.rank === 1
                      ? 'rgba(250, 204, 21, 0.3)'
                      : entry.rank === 2
                        ? 'rgba(192, 192, 192, 0.3)'
                        : 'rgba(251, 146, 60, 0.3)'
                  }`
                } : undefined}>
                  {entry.rank}
                </div>

                {/* Color indicator */}
                <div
                  className="w-2.5 h-2.5 flex-shrink-0"
                  style={{
                    backgroundColor: entry.playerColor,
                    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                    boxShadow: isSelf ? `0 0 8px ${entry.playerColor}` : undefined,
                  }}
                />

                {/* Name */}
                <span className={`flex-1 truncate text-sm ${
                  isSelf ? 'text-game-text font-semibold' : 'text-game-text-dim'
                }`}>
                  {entry.playerName}
                  {isSelf && <span className="text-game-accent ml-1 text-[10px]">(YOU)</span>}
                </span>

                {/* Score */}
                <span className={`text-sm font-mono font-medium ${
                  isSelf ? 'text-game-accent' : 'text-game-text-muted'
                }`}>
                  {entry.score.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Show own rank if not in top 10 */}
      {player && leaderboard.length > 0 && !leaderboard.slice(0, 10).some((e) => e.playerId === player.id) && (
        <div className="mt-2 pt-2 border-t border-game-border">
          <div className="flex items-center gap-2 py-2 px-2.5 -mx-2 bg-game-accent/10 border-l-2 border-l-game-accent">
            <div className="w-6 h-6 flex items-center justify-center text-xs font-bold font-mono text-game-text-muted">
              {leaderboard.findIndex((e) => e.playerId === player.id) + 1 || '?'}
            </div>
            <div
              className="w-2.5 h-2.5 flex-shrink-0"
              style={{
                backgroundColor: player.color,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                boxShadow: `0 0 8px ${player.color}`,
              }}
            />
            <span className="flex-1 truncate text-sm text-game-text font-semibold">
              {player.name}
              <span className="text-game-accent ml-1 text-[10px]">(YOU)</span>
            </span>
            <span className="text-sm font-mono font-medium text-game-accent">
              {player.score.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Decorative bottom line */}
      <div className="h-px bg-gradient-to-r from-transparent via-game-accent/30 to-transparent mt-2" />
    </div>
  );
}
