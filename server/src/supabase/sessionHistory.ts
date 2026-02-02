import { getSupabaseClient } from './client.js';
import type { Session, LeaderboardEntry, SessionHistoryEntry, SessionHistoryDetail } from 'shared';

export interface SaveSessionData {
  session: Session;
  leaderboard: LeaderboardEntry[];
  peakPlayerCount: number;
}

export async function saveSessionHistory(data: SaveSessionData): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('[SessionHistory] Supabase not configured, skipping session save');
    return false;
  }
  const { session, leaderboard, peakPlayerCount } = data;

  try {
    // Calculate percentages
    const revealPercentage = session.totalCells > 0
      ? (session.cellsRevealed / session.totalCells) * 100
      : 0;
    const mineExplosionPercentage = session.totalMines > 0
      ? (session.minesExploded / session.totalMines) * 100
      : 0;

    // Calculate duration
    const durationSeconds = session.endTime
      ? Math.floor((session.endTime - session.startTime) / 1000)
      : 0;

    // Insert session history
    const { error: sessionError } = await supabase
      .from('session_history')
      .insert({
        id: session.id,
        started_at: new Date(session.startTime).toISOString(),
        ended_at: new Date(session.endTime || Date.now()).toISOString(),
        duration_seconds: durationSeconds,
        end_reason: session.endReason || 'time_limit',
        map_width: session.mapWidth,
        map_height: session.mapHeight,
        total_mines: session.totalMines,
        mines_exploded: session.minesExploded,
        cells_revealed: session.cellsRevealed,
        total_cells: session.totalCells,
        reveal_percentage: revealPercentage,
        mine_explosion_percentage: mineExplosionPercentage,
        peak_player_count: peakPlayerCount,
      });

    if (sessionError) {
      console.error('[SessionHistory] Failed to save session:', sessionError);
      return false;
    }

    // Insert top players (top 10)
    const topPlayers = leaderboard.slice(0, 10);
    if (topPlayers.length > 0) {
      const playersData = topPlayers.map((player, index) => ({
        session_id: session.id,
        rank: index + 1,
        player_name: player.playerName,
        player_color: player.playerColor,
        score: player.score,
        cells_revealed: player.cellsRevealed || 0,
        mines_triggered: 0,
        chain_reveals: 0,
      }));

      const { error: playersError } = await supabase
        .from('session_top_players')
        .insert(playersData);

      if (playersError) {
        console.error('[SessionHistory] Failed to save top players:', playersError);
      }
    }

    console.log(`[SessionHistory] Saved session ${session.id} with ${topPlayers.length} top players`);
    return true;
  } catch (error) {
    console.error('[SessionHistory] Error saving session:', error);
    return false;
  }
}

export async function getSessionHistory(limit: number = 20, offset: number = 0): Promise<SessionHistoryEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('[SessionHistory] Supabase not configured, returning empty history');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('session_history')
      .select('*')
      .order('ended_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[SessionHistory] Failed to fetch history:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      startedAt: new Date(row.started_at).getTime(),
      endedAt: new Date(row.ended_at).getTime(),
      durationSeconds: row.duration_seconds,
      endReason: row.end_reason as 'mines_exploded' | 'map_cleared' | 'time_limit',
      mapWidth: row.map_width,
      mapHeight: row.map_height,
      totalMines: row.total_mines,
      minesExploded: row.mines_exploded,
      cellsRevealed: row.cells_revealed,
      totalCells: row.total_cells,
      revealPercentage: parseFloat(row.reveal_percentage),
      mineExplosionPercentage: parseFloat(row.mine_explosion_percentage),
      peakPlayerCount: row.peak_player_count,
    }));
  } catch (error) {
    console.error('[SessionHistory] Error fetching history:', error);
    return [];
  }
}

export async function getSessionDetail(sessionId: string): Promise<SessionHistoryDetail | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('[SessionHistory] Supabase not configured, returning null');
    return null;
  }

  try {
    // Fetch session
    const { data: sessionData, error: sessionError } = await supabase
      .from('session_history')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error('[SessionHistory] Failed to fetch session detail:', sessionError);
      return null;
    }

    // Fetch top players
    const { data: playersData, error: playersError } = await supabase
      .from('session_top_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('rank', { ascending: true });

    if (playersError) {
      console.error('[SessionHistory] Failed to fetch top players:', playersError);
    }

    const session: SessionHistoryEntry = {
      id: sessionData.id,
      startedAt: new Date(sessionData.started_at).getTime(),
      endedAt: new Date(sessionData.ended_at).getTime(),
      durationSeconds: sessionData.duration_seconds,
      endReason: sessionData.end_reason as 'mines_exploded' | 'map_cleared' | 'time_limit',
      mapWidth: sessionData.map_width,
      mapHeight: sessionData.map_height,
      totalMines: sessionData.total_mines,
      minesExploded: sessionData.mines_exploded,
      cellsRevealed: sessionData.cells_revealed,
      totalCells: sessionData.total_cells,
      revealPercentage: parseFloat(sessionData.reveal_percentage),
      mineExplosionPercentage: parseFloat(sessionData.mine_explosion_percentage),
      peakPlayerCount: sessionData.peak_player_count,
    };

    const topPlayers = (playersData || []).map(row => ({
      rank: row.rank,
      playerName: row.player_name,
      playerColor: row.player_color,
      score: row.score,
      cellsRevealed: row.cells_revealed,
      minesTriggered: row.mines_triggered,
      chainReveals: row.chain_reveals,
    }));

    return { session, topPlayers };
  } catch (error) {
    console.error('[SessionHistory] Error fetching session detail:', error);
    return null;
  }
}
