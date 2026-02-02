import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import type { SessionHistoryEntry, SessionHistoryDetail, SessionTopPlayer } from 'shared';

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionHistory({ isOpen, onClose }: SessionHistoryProps) {
  const { socket, requestSessionHistory, requestSessionDetail } = useSocket();
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load history when opened
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      requestSessionHistory(20, 0);
    }
  }, [isOpen, requestSessionHistory]);

  // Listen for session history events
  useEffect(() => {
    const handleHistoryList = (data: SessionHistoryEntry[]) => {
      setHistory(data);
      setIsLoading(false);
    };

    const handleHistoryDetail = (data: SessionHistoryDetail | null) => {
      setSelectedSession(data);
      setIsLoading(false);
    };

    socket.on('session_history:list', handleHistoryList);
    socket.on('session_history:detail', handleHistoryDetail);

    return () => {
      socket.off('session_history:list', handleHistoryList);
      socket.off('session_history:detail', handleHistoryDetail);
    };
  }, [socket]);

  const handleClose = useCallback(() => {
    setSelectedSession(null);
    onClose();
  }, [onClose]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setIsLoading(true);
    requestSessionDetail(sessionId);
  }, [requestSessionDetail]);

  const handleBackToList = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    if (isToday) {
      return `Today ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (isYesterday) {
      return `Yesterday ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getEndReasonText = (reason: string): string => {
    switch (reason) {
      case 'mines_exploded': return 'Mine Limit Reached';
      case 'map_cleared': return 'Map Cleared';
      case 'time_limit': return 'Time Expired';
      default: return reason;
    }
  };

  const getEndReasonIcon = (reason: string): string => {
    switch (reason) {
      case 'mines_exploded': return '//';
      case 'map_cleared': return '+';
      case 'time_limit': return '!';
      default: return '>';
    }
  };

  const getEndReasonStyle = (reason: string) => {
    switch (reason) {
      case 'mines_exploded':
        return { bg: 'bg-game-danger/10', border: 'border-game-danger/30', text: 'text-game-danger' };
      case 'map_cleared':
        return { bg: 'bg-game-success/10', border: 'border-game-success/30', text: 'text-game-success' };
      case 'time_limit':
        return { bg: 'bg-game-accent/10', border: 'border-game-accent/30', text: 'text-game-accent' };
      default:
        return { bg: 'bg-game-primary', border: 'border-game-border', text: 'text-game-text-muted' };
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-game-border">
          <div className="flex items-center gap-3">
            {selectedSession && (
              <button
                onClick={handleBackToList}
                className="text-game-text-muted hover:text-game-accent transition-colors font-mono text-sm"
              >
                [&lt;-]
              </button>
            )}
            <div className="game-panel-header mb-0">
              {selectedSession ? 'Operation Report' : 'Mission Archive'}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-game-text-muted hover:text-game-accent transition-colors font-mono text-sm"
          >
            [X]
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-game-accent/30 border-t-game-accent animate-spin"
                   style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
              <span className="text-game-text-muted text-sm font-mono">Loading data...</span>
            </div>
          ) : selectedSession ? (
            <SessionDetailView
              detail={selectedSession}
              formatDuration={formatDuration}
              formatDate={formatDate}
              getEndReasonText={getEndReasonText}
              getEndReasonIcon={getEndReasonIcon}
              getEndReasonStyle={getEndReasonStyle}
            />
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-game-primary border border-game-border text-game-text-muted text-2xl"
                style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
              >
                //
              </div>
              <p className="text-game-text-dim">No missions recorded.</p>
              <p className="text-sm mt-2 text-game-text-muted">Records will appear after session completion.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((session) => {
                const style = getEndReasonStyle(session.endReason);
                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`relative p-3 cursor-pointer transition-all border ${style.border} ${style.bg} hover:border-game-accent/50`}
                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
                  >
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 flex items-center justify-center text-xs font-bold ${style.text} ${style.bg} border ${style.border}`}
                          style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                        >
                          {getEndReasonIcon(session.endReason)}
                        </div>
                        <span className={`text-sm font-semibold ${style.text}`}>
                          {getEndReasonText(session.endReason)}
                        </span>
                      </div>
                      <span className="text-game-text-muted text-xs font-mono">
                        {formatDate(session.endedAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-game-text-muted block">Duration</span>
                        <p className="text-game-text font-mono">{formatDuration(session.durationSeconds)}</p>
                      </div>
                      <div>
                        <span className="text-game-text-muted block">Progress</span>
                        <p className="text-game-accent font-mono font-bold">{session.revealPercentage.toFixed(1)}%</p>
                      </div>
                      <div>
                        <span className="text-game-text-muted block">Peak Agents</span>
                        <p className="text-game-text font-mono">{session.peakPlayerCount}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SessionDetailViewProps {
  detail: SessionHistoryDetail;
  formatDuration: (seconds: number) => string;
  formatDate: (timestamp: number) => string;
  getEndReasonText: (reason: string) => string;
  getEndReasonIcon: (reason: string) => string;
  getEndReasonStyle: (reason: string) => { bg: string; border: string; text: string };
}

function SessionDetailView({
  detail,
  formatDuration,
  formatDate,
  getEndReasonText,
  getEndReasonIcon,
  getEndReasonStyle,
}: SessionDetailViewProps) {
  const { session, topPlayers } = detail;
  const style = getEndReasonStyle(session.endReason);

  return (
    <div className="space-y-4">
      {/* Session Summary */}
      <div
        className={`p-4 ${style.bg} border ${style.border}`}
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)' }}
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-game-border/50">
          <div
            className={`w-10 h-10 flex items-center justify-center text-lg font-bold ${style.text} ${style.bg} border ${style.border}`}
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
          >
            {getEndReasonIcon(session.endReason)}
          </div>
          <div>
            <div className={`text-sm font-semibold ${style.text}`}>
              {getEndReasonText(session.endReason)}
            </div>
            <p className="text-game-text-muted text-xs font-mono">
              {formatDate(session.startedAt)} ~ {formatDate(session.endedAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Duration" value={formatDuration(session.durationSeconds)} />
          <StatCard label="Peak Agents" value={`${session.peakPlayerCount}`} color="accent" />
          <StatCard label="Progress" value={`${session.revealPercentage.toFixed(1)}%`} color="success" />
          <StatCard label="Detonations" value={`${session.mineExplosionPercentage.toFixed(1)}%`} color="danger" />
        </div>

        <div className="mt-4 pt-3 border-t border-game-border/50 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-game-text-muted block">Cells Revealed</span>
            <p className="text-game-text font-mono">{session.cellsRevealed.toLocaleString()} / {session.totalCells.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-game-text-muted block">Mines Triggered</span>
            <p className="text-game-text font-mono">{session.minesExploded.toLocaleString()} / {session.totalMines.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-game-text-muted block">Operation Area</span>
            <p className="text-game-text font-mono">{session.mapWidth} x {session.mapHeight}</p>
          </div>
          <div>
            <span className="text-game-text-muted block">Total Hazards</span>
            <p className="text-game-text font-mono">{session.totalMines.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Top Players */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
          <span className="w-1 h-1 bg-game-accent rotate-45" />
          Top 10 Operatives
        </div>

        {topPlayers.length === 0 ? (
          <p className="text-game-text-muted text-center py-4 text-sm">No operative records.</p>
        ) : (
          <div className="space-y-1">
            {topPlayers.map((player) => (
              <PlayerRow key={player.rank} player={player} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'white',
}: {
  label: string;
  value: string;
  color?: 'white' | 'accent' | 'success' | 'danger';
}) {
  const colorClasses = {
    white: 'text-game-text',
    accent: 'text-game-accent',
    success: 'text-game-success',
    danger: 'text-game-danger',
  };

  return (
    <div className="text-center p-2 bg-game-primary/50">
      <p className="text-game-text-muted text-[9px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}

function PlayerRow({ player }: { player: SessionTopPlayer }) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-game-accent/20', border: 'border-game-accent', text: 'text-game-accent' };
    if (rank === 2) return { bg: 'bg-gray-400/20', border: 'border-gray-400', text: 'text-gray-400' };
    if (rank === 3) return { bg: 'bg-orange-400/20', border: 'border-orange-400', text: 'text-orange-400' };
    return { bg: 'bg-game-primary', border: 'border-game-border', text: 'text-game-text-muted' };
  };

  const style = getRankStyle(player.rank);

  return (
    <div
      className="p-2 flex items-center gap-3 bg-game-primary/30 border border-game-border/50 hover:border-game-accent/20 transition-all"
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)' }}
    >
      {/* Rank badge */}
      <div
        className={`w-7 h-7 flex items-center justify-center text-sm font-bold ${style.text} ${style.bg} border ${style.border}`}
        style={{ clipPath: player.rank <= 3 ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' : 'none' }}
      >
        {player.rank}
      </div>

      {/* Color indicator */}
      <div
        className="w-3 h-3 flex-shrink-0"
        style={{
          backgroundColor: player.playerColor,
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        }}
      />

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-game-text truncate">{player.playerName}</p>
        <p className="text-game-text-muted text-xs font-mono">
          {player.cellsRevealed.toLocaleString()} cells · {player.chainReveals} chains
        </p>
      </div>

      {/* Score */}
      <div className="text-right">
        <p className="text-sm text-game-accent font-bold font-mono">{player.score.toLocaleString()}</p>
        {player.minesTriggered > 0 && (
          <p className="text-game-danger text-xs font-mono">{player.minesTriggered} detonations</p>
        )}
      </div>
    </div>
  );
}
