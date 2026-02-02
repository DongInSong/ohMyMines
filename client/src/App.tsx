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

  // Score tracking is handled in useSocket.ts via session:ending event

  // Show login if no player
  if (!player) {
    return <LoginScreen />;
  }

  return <GameLayout />;
}

export default App;
