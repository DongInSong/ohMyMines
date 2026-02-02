import { useState, useCallback } from 'react';
import { GUILD_CONSTRAINTS, PLAYER_COLORS } from 'shared';
import { useSocket } from '../../hooks/useSocket';
import { useGuildStore } from '../../stores/guildStore';
import { usePlayerStore } from '../../stores/playerStore';

export function GuildPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [guildName, setGuildName] = useState('');
  const [guildTag, setGuildTag] = useState('');
  const [guildColor, setGuildColor] = useState(PLAYER_COLORS[0]);

  const { createGuild, joinGuild, leaveGuild } = useSocket();

  const currentGuild = useGuildStore((s) => s.currentGuild);
  const currentBuff = useGuildStore((s) => s.currentBuff);
  const invites = useGuildStore((s) => s.invites);
  const guilds = useGuildStore((s) => s.guilds);
  const removeInvite = useGuildStore((s) => s.removeInvite);

  const player = usePlayerStore((s) => s.player);

  const handleCreate = useCallback(() => {
    if (!guildName || !guildTag) return;
    createGuild(guildName, guildTag, guildColor);
    setCreateMode(false);
    setGuildName('');
    setGuildTag('');
  }, [guildName, guildTag, guildColor, createGuild]);

  const handleAcceptInvite = useCallback(
    (guildId: string) => {
      joinGuild(guildId);
      removeInvite(guildId);
    },
    [joinGuild, removeInvite]
  );

  const handleDeclineInvite = useCallback(
    (guildId: string) => {
      removeInvite(guildId);
    },
    [removeInvite]
  );

  // Summary button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="game-panel corner-cut-sm flex items-center gap-2 cursor-pointer hover:border-game-accent/30 transition-colors"
      >
        <span className="w-1 h-1 bg-game-accent rotate-45" />
        <span className="text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em]">
          {currentGuild ? `[${currentGuild.tag}]` : 'Squad'}
        </span>
        {invites.length > 0 && (
          <span
            className="bg-game-accent text-game-bg text-[10px] px-1.5 font-bold"
            style={{ clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)' }}
          >
            {invites.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content w-[28rem] max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-game-border">
          <div className="game-panel-header mb-0">Squadron Command</div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-game-text-muted hover:text-game-accent transition-colors font-mono text-sm"
          >
            [X]
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Current Guild */}
          {currentGuild ? (
            <div className="space-y-4">
              {/* Guild Info */}
              <div
                className="p-4 bg-game-accent/5 border-l-2 border-l-game-accent"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 flex items-center justify-center"
                    style={{
                      backgroundColor: currentGuild.color,
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-game-accent font-bold">[{currentGuild.tag}]</span>
                      <span className="text-game-text font-semibold">{currentGuild.name}</span>
                    </div>
                    <div className="text-[10px] text-game-text-muted uppercase tracking-wider">Active Squadron</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-game-primary/50">
                    <div className="text-lg font-bold text-game-text font-mono">{currentGuild.memberIds.length}</div>
                    <div className="text-[9px] text-game-text-muted uppercase tracking-wider">Members</div>
                  </div>
                  <div className="p-2 bg-game-primary/50">
                    <div className="text-lg font-bold text-game-accent font-mono">{currentGuild.score.toLocaleString()}</div>
                    <div className="text-[9px] text-game-text-muted uppercase tracking-wider">Score</div>
                  </div>
                  <div className="p-2 bg-game-primary/50">
                    <div className="text-lg font-bold text-game-text font-mono">{currentGuild.chunksOwned.length}</div>
                    <div className="text-[9px] text-game-text-muted uppercase tracking-wider">Territory</div>
                  </div>
                </div>
              </div>

              {/* Buffs */}
              {(currentBuff.scoreBonus > 0 || currentBuff.cooldownReduction > 0 || currentBuff.itemDropBonus > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em]">
                    <span className="w-1 h-1 bg-game-accent rotate-45" />
                    Active Buffs
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {currentBuff.scoreBonus > 0 && (
                      <div className="p-2 bg-game-success/10 border border-game-success/30 text-center">
                        <div className="text-sm font-bold text-game-success">+{(currentBuff.scoreBonus * 100).toFixed(0)}%</div>
                        <div className="text-[9px] text-game-text-muted uppercase">Score</div>
                      </div>
                    )}
                    {currentBuff.cooldownReduction > 0 && (
                      <div className="p-2 bg-game-info/10 border border-game-info/30 text-center">
                        <div className="text-sm font-bold text-game-info">-{(currentBuff.cooldownReduction * 100).toFixed(0)}%</div>
                        <div className="text-[9px] text-game-text-muted uppercase">Cooldown</div>
                      </div>
                    )}
                    {currentBuff.itemDropBonus > 0 && (
                      <div className="p-2 bg-game-accent/10 border border-game-accent/30 text-center">
                        <div className="text-sm font-bold text-game-accent">+{(currentBuff.itemDropBonus * 100).toFixed(0)}%</div>
                        <div className="text-[9px] text-game-text-muted uppercase">Item Drop</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={leaveGuild}
                className="w-full py-2 text-sm text-game-danger bg-game-danger/10 border border-game-danger/30 hover:bg-game-danger/20 transition-colors font-mono"
                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              >
                [LEAVE SQUADRON]
              </button>
            </div>
          ) : (
            <>
              {/* Invites */}
              {invites.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
                    <span className="w-1 h-1 bg-game-accent rotate-45" />
                    Incoming Requests
                  </div>
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div
                        key={invite.guildId}
                        className="flex items-center justify-between p-3 bg-game-accent/5 border border-game-accent/20"
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      >
                        <div>
                          <div className="text-sm text-game-text font-semibold">{invite.guildName}</div>
                          <div className="text-[10px] text-game-text-muted">
                            From: <span className="text-game-accent">{invite.inviterName}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptInvite(invite.guildId)}
                            className="px-3 py-1 text-xs bg-game-accent text-game-bg font-bold hover:bg-game-accent-bright transition-colors"
                            style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
                          >
                            ACCEPT
                          </button>
                          <button
                            onClick={() => handleDeclineInvite(invite.guildId)}
                            className="px-3 py-1 text-xs text-game-text-muted hover:text-game-text transition-colors font-mono"
                          >
                            [X]
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create Guild */}
              {createMode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
                    <span className="w-1 h-1 bg-game-accent rotate-45" />
                    Create Squadron
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-game-text-muted uppercase tracking-wider">Squadron Name</label>
                      <input
                        type="text"
                        placeholder="Enter name..."
                        value={guildName}
                        onChange={(e) => setGuildName(e.target.value)}
                        maxLength={GUILD_CONSTRAINTS.MAX_NAME_LENGTH}
                        className="game-input w-full"
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-game-text-muted uppercase tracking-wider">Tag (2-5 chars)</label>
                      <input
                        type="text"
                        placeholder="TAG"
                        value={guildTag}
                        onChange={(e) => setGuildTag(e.target.value.toUpperCase())}
                        maxLength={GUILD_CONSTRAINTS.TAG_LENGTH_MAX}
                        className="game-input w-full"
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-game-text-muted uppercase tracking-wider">Squadron Color</label>
                      <div className="flex flex-wrap gap-1">
                        {PLAYER_COLORS.map((color) => (
                          <button
                            key={color}
                            className={`w-7 h-7 transition-all ${
                              guildColor === color ? 'ring-2 ring-game-accent ring-offset-1 ring-offset-game-bg scale-110' : 'hover:scale-105'
                            }`}
                            style={{
                              backgroundColor: color,
                              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                            }}
                            onClick={() => setGuildColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleCreate}
                        disabled={
                          guildName.length < GUILD_CONSTRAINTS.MIN_NAME_LENGTH ||
                          guildTag.length < GUILD_CONSTRAINTS.TAG_LENGTH_MIN
                        }
                        className="flex-1 py-2 text-sm bg-game-accent text-game-bg font-bold hover:bg-game-accent-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      >
                        CREATE
                      </button>
                      <button
                        onClick={() => setCreateMode(false)}
                        className="flex-1 py-2 text-sm text-game-text-muted bg-game-primary border border-game-border hover:border-game-accent/30 transition-colors font-mono"
                        style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
                      >
                        [CANCEL]
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreateMode(true)}
                  className="game-button w-full"
                >
                  + Create Squadron
                </button>
              )}

              {/* Guild List */}
              {guilds.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
                    <span className="w-1 h-1 bg-game-accent rotate-45" />
                    Active Squadrons
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {guilds.map((guild) => (
                      <div
                        key={guild.id}
                        className="flex items-center gap-3 p-2 bg-game-primary/30 hover:bg-game-primary/50 border border-game-border/50 hover:border-game-accent/20 transition-all cursor-pointer"
                        style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
                      >
                        <div
                          className="w-4 h-4 flex-shrink-0"
                          style={{
                            backgroundColor: guild.color,
                            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                          }}
                        />
                        <span className="text-sm text-game-text-muted font-mono">[{guild.tag}]</span>
                        <span className="text-sm text-game-text flex-1">{guild.name}</span>
                        <span className="text-xs text-game-text-muted font-mono">
                          {guild.memberIds.length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
