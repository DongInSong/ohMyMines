import { useState, useEffect } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { musicManager } from '../../utils/MusicManager';
import { SessionHistory } from './SessionHistory';
import type { GameSettings } from 'shared';

export function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const settings = usePlayerStore((s) => s.settings);
  const setSettings = usePlayerStore((s) => s.setSettings);

  // Update music playing state
  useEffect(() => {
    const interval = setInterval(() => {
      setIsMusicPlaying(musicManager.getIsPlaying());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const toggleMusic = () => {
    musicManager.toggle();
    setIsMusicPlaying(musicManager.getIsPlaying());
  };

  const handleToggle = (key: keyof GameSettings) => {
    setSettings({ [key]: !settings[key] });
  };

  const handleVolumeChange = (key: 'sfxVolume' | 'musicVolume', value: number) => {
    setSettings({ [key]: value });
  };

  const handleCursorRateChange = (rate: 'low' | 'medium' | 'high') => {
    setSettings({ cursorUpdateRate: rate });
  };

  // Toggle switch component
  const ToggleSwitch = ({ enabled, onClick }: { enabled: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-10 h-5 transition-colors cursor-pointer ${
        enabled ? 'bg-game-accent/30' : 'bg-game-primary'
      }`}
      style={{
        border: `1px solid ${enabled ? 'var(--game-accent)' : 'var(--game-border)'}`,
        clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
      }}
    >
      <div
        className={`absolute top-0.5 w-4 h-3.5 transition-all ${
          enabled ? 'left-5 bg-game-accent' : 'left-0.5 bg-game-text-muted'
        }`}
        style={{ clipPath: 'polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)' }}
      />
    </button>
  );

  return (
    <>
      {/* Settings button */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="game-panel corner-cut-sm flex items-center gap-2 cursor-pointer hover:border-game-accent/30 transition-colors"
          title="Settings"
        >
          <span className="w-1 h-1 bg-game-accent rotate-45" />
          <span className="text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em]">Config</span>
        </button>
      ) : (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content w-96" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-game-border">
              <div className="game-panel-header mb-0">System Configuration</div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-game-text-muted hover:text-game-accent transition-colors font-mono text-sm"
              >
                [X]
              </button>
            </div>

            <div className="space-y-6">
              {/* Sound Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
                  <span className="w-1 h-1 bg-game-accent rotate-45" />
                  Audio
                </div>

                {/* Sound Enabled */}
                <div className="flex items-center justify-between group">
                  <span className="text-sm text-game-text-dim group-hover:text-game-text transition-colors">Sound Effects</span>
                  <ToggleSwitch enabled={settings.soundEnabled} onClick={() => handleToggle('soundEnabled')} />
                </div>

                {/* SFX Volume */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-game-text-dim">SFX Volume</span>
                    <span className="text-game-text-muted font-mono">{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <div className="relative h-1.5 bg-game-primary border border-game-border">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-game-accent-dim to-game-accent transition-all"
                      style={{ width: `${settings.sfxVolume * 100}%`, opacity: settings.soundEnabled ? 1 : 0.3 }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.sfxVolume * 100}
                      onChange={(e) => handleVolumeChange('sfxVolume', parseInt(e.target.value) / 100)}
                      disabled={!settings.soundEnabled}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 transition-all pointer-events-none ${
                        settings.soundEnabled ? 'bg-game-accent' : 'bg-game-text-muted'
                      }`}
                      style={{
                        left: `calc(${settings.sfxVolume * 100}% - 6px)`,
                        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                      }}
                    />
                  </div>
                </div>

                {/* Music Toggle */}
                <div className="flex items-center justify-between group">
                  <span className="text-sm text-game-text-dim group-hover:text-game-text transition-colors">Music</span>
                  <ToggleSwitch enabled={isMusicPlaying} onClick={toggleMusic} />
                </div>

                {/* Music Volume */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-game-text-dim">Music Volume</span>
                    <span className="text-game-text-muted font-mono">{Math.round(settings.musicVolume * 100)}%</span>
                  </div>
                  <div className="relative h-1.5 bg-game-primary border border-game-border">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-game-accent-dim to-game-accent transition-all"
                      style={{ width: `${settings.musicVolume * 100}%`, opacity: isMusicPlaying ? 1 : 0.3 }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.musicVolume * 100}
                      onChange={(e) => handleVolumeChange('musicVolume', parseInt(e.target.value) / 100)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 transition-all pointer-events-none ${
                        isMusicPlaying ? 'bg-game-accent' : 'bg-game-text-muted'
                      }`}
                      style={{
                        left: `calc(${settings.musicVolume * 100}% - 6px)`,
                        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Display Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
                  <span className="w-1 h-1 bg-game-accent rotate-45" />
                  Display
                </div>

                {/* Show Other Cursors */}
                <div className="flex items-center justify-between group">
                  <span className="text-sm text-game-text-dim group-hover:text-game-text transition-colors">Show Other Cursors</span>
                  <ToggleSwitch enabled={settings.showOtherCursors} onClick={() => handleToggle('showOtherCursors')} />
                </div>

                {/* Cursor Update Rate */}
                <div className="space-y-2">
                  <span className="text-sm text-game-text-dim">Cursor Update Rate</span>
                  <div className="flex gap-1">
                    {(['low', 'medium', 'high'] as const).map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleCursorRateChange(rate)}
                        className={`flex-1 py-1.5 px-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                          settings.cursorUpdateRate === rate
                            ? 'bg-game-accent/20 text-game-accent border-game-accent'
                            : 'bg-game-primary text-game-text-muted border-game-border hover:border-game-accent/30'
                        }`}
                        style={{
                          border: '1px solid',
                          clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                        }}
                      >
                        {rate}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Communication Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
                  <span className="w-1 h-1 bg-game-accent rotate-45" />
                  Communication
                </div>

                {/* Chat Enabled */}
                <div className="flex items-center justify-between group">
                  <span className="text-sm text-game-text-dim group-hover:text-game-text transition-colors">Show Chat</span>
                  <ToggleSwitch enabled={settings.chatEnabled} onClick={() => handleToggle('chatEnabled')} />
                </div>

                {/* Notifications Enabled */}
                <div className="flex items-center justify-between group">
                  <span className="text-sm text-game-text-dim group-hover:text-game-text transition-colors">Show Notifications</span>
                  <ToggleSwitch enabled={settings.notificationsEnabled} onClick={() => handleToggle('notificationsEnabled')} />
                </div>
              </div>

              {/* Data Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-game-accent uppercase tracking-[0.15em] pb-2 border-b border-game-border/50">
                  <span className="w-1 h-1 bg-game-accent rotate-45" />
                  Data
                </div>

                {/* Session History Button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsHistoryOpen(true);
                  }}
                  className="game-button secondary w-full"
                >
                  Session History
                </button>
              </div>
            </div>

            {/* Reset Button */}
            <div className="mt-6 pt-4 border-t border-game-border">
              <button
                onClick={() => {
                  setSettings({
                    soundEnabled: true,
                    musicVolume: 0.5,
                    sfxVolume: 0.7,
                    showOtherCursors: true,
                    cursorUpdateRate: 'medium',
                    chatEnabled: true,
                    notificationsEnabled: true,
                  });
                }}
                className="w-full py-2 text-sm text-game-text-muted bg-game-primary hover:bg-game-secondary border border-game-border transition-colors font-mono"
                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              >
                [RESET TO DEFAULTS]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session History Modal */}
      {isHistoryOpen && (
        <SessionHistory isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      )}
    </>
  );
}
