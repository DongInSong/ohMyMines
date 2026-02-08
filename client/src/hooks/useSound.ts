import { useEffect } from 'react';
import { soundManager } from '../utils/SoundManager';
import { musicManager } from '../utils/MusicManager';
import { usePlayerStore } from '../stores/playerStore';

export function useSound() {
  const settings = usePlayerStore((s) => s.settings);

  // Sync sound settings with sound manager
  useEffect(() => {
    soundManager.setEnabled(settings.soundEnabled);
    soundManager.setVolume(settings.sfxVolume);
  }, [settings.soundEnabled, settings.sfxVolume]);

  // Sync music settings with music manager
  useEffect(() => {
    musicManager.setVolume(settings.musicVolume);
  }, [settings.musicVolume]);

  return {
    playReveal: (isChain: boolean = false) => {
      soundManager.play(isChain ? 'revealChain' : 'reveal');
    },
    playExplosion: () => soundManager.play('explosion'),
    playFlag: () => soundManager.play('flag'),
    playUnflag: () => soundManager.play('unflag'),
    playItem: () => soundManager.play('item'),
    playAchievement: () => soundManager.play('achievement'),
    playChat: () => soundManager.play('chat'),
    playError: () => soundManager.play('error'),
    playSkill: () => soundManager.play('skill'),
    playCombo: () => soundManager.play('combo'),
    playFever: () => soundManager.play('fever'),
    playTreasure: () => soundManager.play('treasure'),
    // Music controls
    startMusic: () => musicManager.start(),
    stopMusic: () => musicManager.stop(),
    toggleMusic: () => musicManager.toggle(),
    isMusicPlaying: () => musicManager.getIsPlaying(),
  };
}

// Export direct access for use outside React components
export { soundManager, musicManager };
