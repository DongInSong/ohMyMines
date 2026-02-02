import { useState } from 'react';
import { ACHIEVEMENTS } from 'shared';
import { usePlayerStore } from '../../stores/playerStore';

export function Achievements() {
  const [isOpen, setIsOpen] = useState(false);
  const achievements = usePlayerStore((s) => s.achievements);

  const completedCount = achievements.filter((a) => a.completed).length;
  const totalCount = ACHIEVEMENTS.length;

  const isAchievementCompleted = (id: string) => {
    return achievements.some((a) => a.achievementId === id && a.completed);
  };

  const getAchievementProgress = (id: string) => {
    const progress = achievements.find((a) => a.achievementId === id);
    return progress?.currentValue ?? 0;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="game-panel corner-cut-sm flex items-center gap-2 cursor-pointer hover:border-game-accent/30 transition-colors"
      >
        <span className="w-1 h-1 bg-game-accent rotate-45" />
        <span className="text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em]">
          Medals {completedCount}/{totalCount}
        </span>
      </button>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content w-[28rem] max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-game-border">
          <div className="game-panel-header mb-0">Achievement Records</div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-game-text-muted hover:text-game-accent transition-colors font-mono text-sm"
          >
            [X]
          </button>
        </div>

        {/* Progress Summary */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-game-border/50">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-game-text-dim">Progress</span>
              <span className="text-game-accent font-mono font-bold">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-1.5 bg-game-primary border border-game-border overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-game-accent-dim to-game-accent transition-all"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Achievements List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {ACHIEVEMENTS.map((achievement) => {
            const completed = isAchievementCompleted(achievement.id);
            const progress = getAchievementProgress(achievement.id);
            const progressPercent = Math.min(
              100,
              (progress / achievement.requirement.value) * 100
            );

            return (
              <div
                key={achievement.id}
                className={`relative p-3 transition-all ${
                  completed
                    ? 'bg-game-accent/10 border-l-2 border-l-game-accent'
                    : 'bg-game-primary/50 border-l-2 border-l-game-border'
                }`}
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)',
                }}
              >
                {/* Top shine for completed */}
                {completed && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-game-accent/50 via-game-accent to-game-accent/50" />
                )}

                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 flex items-center justify-center text-lg flex-shrink-0 ${
                      completed ? 'bg-game-accent/20 border-game-accent/50' : 'bg-game-primary border-game-border'
                    }`}
                    style={{
                      border: '1px solid',
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    }}
                  >
                    {achievement.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${completed ? 'text-game-accent' : 'text-game-text'}`}>
                        {achievement.name}
                      </span>
                      {completed && (
                        <span
                          className="w-4 h-4 bg-game-accent flex items-center justify-center text-[10px] text-game-bg font-bold"
                          style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-game-text-muted mt-0.5">{achievement.description}</p>

                    {/* Progress bar for incomplete */}
                    {!completed && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-game-text-muted mb-1 font-mono">
                          <span>{progress}</span>
                          <span>{achievement.requirement.value}</span>
                        </div>
                        <div className="h-1 bg-game-primary border border-game-border overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-game-text-muted to-game-text-dim transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Reward */}
                    {achievement.reward && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-game-accent rotate-45" />
                        <span className="text-[10px] text-game-text-muted uppercase tracking-wider">
                          Reward:{' '}
                          <span className="text-game-accent">
                            {achievement.reward.type === 'score' && `+${achievement.reward.value} PTS`}
                            {achievement.reward.type === 'title' && `"${achievement.reward.value}"`}
                            {achievement.reward.type === 'item' && 'Special Item'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
