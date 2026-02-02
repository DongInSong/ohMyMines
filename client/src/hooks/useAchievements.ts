import { useEffect, useCallback, useRef } from 'react';
import { ACHIEVEMENTS } from 'shared';
import { usePlayerStore } from '../stores/playerStore';
import { useGameStore } from '../stores/gameStore';

export function useAchievements() {
  const player = usePlayerStore((s) => s.player);
  const checkedRef = useRef<Set<string>>(new Set());

  const checkAchievement = useCallback(
    (achievementId: string, currentValue: number) => {
      const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
      if (!achievement) return;

      // Use getState() to avoid reactive dependency
      const achievements = usePlayerStore.getState().achievements;
      const existingProgress = achievements.find((a) => a.achievementId === achievementId);

      // Skip if already completed
      if (existingProgress?.completed) return;

      // Skip if we already checked this achievement with same or higher value
      const checkKey = `${achievementId}:${currentValue}`;
      if (checkedRef.current.has(checkKey)) return;

      const isCompleted = currentValue >= achievement.requirement.value;

      // Only update if value changed
      if (existingProgress?.currentValue === currentValue) return;

      checkedRef.current.add(checkKey);
      usePlayerStore.getState().updateAchievement(achievementId, currentValue, isCompleted);

      if (isCompleted) {
        useGameStore.getState().addNotification({
          id: crypto.randomUUID(),
          type: 'achievement',
          message: `🏆 업적 달성: ${achievement.emoji} ${achievement.name}`,
          timestamp: Date.now(),
          duration: 5000,
        });
      }
    },
    []
  );

  // Track cell reveals
  useEffect(() => {
    if (!player) return;

    const cellsRevealed = player.stats.cellsRevealed;

    // First step
    if (cellsRevealed >= 1) {
      checkAchievement('first_step', cellsRevealed);
    }

    // Explorer achievements
    checkAchievement('explorer_100', cellsRevealed);
    checkAchievement('explorer_1000', cellsRevealed);
    checkAchievement('legendary_miner', cellsRevealed);
  }, [player?.stats.cellsRevealed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track correct flags
  useEffect(() => {
    if (!player) return;

    const correctFlags = player.stats.correctFlags;
    checkAchievement('flag_novice', correctFlags);
    checkAchievement('mine_detector', correctFlags);
  }, [player?.stats.correctFlags]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track items collected
  useEffect(() => {
    if (!player) return;

    const itemsCollected = player.stats.itemsCollected;
    checkAchievement('item_finder', itemsCollected);
    checkAchievement('hoarder', itemsCollected);
  }, [player?.stats.itemsCollected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track chain reveals
  useEffect(() => {
    if (!player) return;

    const chainReveals = player.stats.chainReveals;
    if (chainReveals >= 50) {
      checkAchievement('chain_master', chainReveals);
    }
  }, [player?.stats.chainReveals]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    checkAchievement,
  };
}
