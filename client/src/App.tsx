import { useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { usePlayerStore } from './stores/playerStore';
import { useAchievements } from './hooks/useAchievements';
import { useSound } from './hooks/useSound';
import { LoginScreen } from './components/LoginScreen';
import { GameLayout } from './components/Layout/GameLayout';

function App() {
  // Initialize socket connection
  useSocket();

  // Initialize achievement tracking
  useAchievements();

  // Initialize sound system (syncs with settings)
  useSound();

  const player = usePlayerStore((s) => s.player);

  // Increment games played when session ends
  useEffect(() => {
    const incrementGamesPlayed = usePlayerStore.getState().incrementGamesPlayed;
    const addToTotalScore = usePlayerStore.getState().addToTotalScore;

    // This would be called when session ends
    // For now, we just track when player disconnects
    return () => {
      if (player) {
        addToTotalScore(player.score);
        incrementGamesPlayed();
      }
    };
  }, [player]);

  // Show login if no player
  if (!player) {
    return <LoginScreen />;
  }

  return <GameLayout />;
}

export default App;
