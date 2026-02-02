import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Player,
  SkillType,
  PlayerSkillState,
  InventoryItem,
  ActiveEffect,
  AchievementProgress,
  GameSettings,
  Guild,
  GuildInvite,
  ComboState,
} from 'shared';
import { DEFAULT_SETTINGS } from 'shared';

interface PlayerState {
  // Player data
  player: Player | null;

  // Persistent data (saved to localStorage)
  savedId: string | null;
  savedName: string;
  savedColor: string;
  achievements: AchievementProgress[];
  totalScore: number;
  gamesPlayed: number;
  settings: GameSettings;

  // Guild
  guild: Guild | null;
  guildInvites: GuildInvite[];

  // Skills (from server, updated locally for UI)
  skillCooldowns: Record<SkillType, number>;
  activeSkills: SkillType[];

  // Items
  inventory: InventoryItem[];
  activeEffects: ActiveEffect[];

  // Combo
  combo: ComboState;

  // Actions
  setPlayer: (player: Player | null) => void;
  updatePlayer: (updates: Partial<Player>) => void;

  setSavedData: (id: string, name: string, color: string) => void;
  setSettings: (settings: Partial<GameSettings>) => void;

  setGuild: (guild: Guild | null) => void;
  addGuildInvite: (invite: GuildInvite) => void;
  removeGuildInvite: (guildId: string) => void;

  updateSkillCooldown: (skillId: SkillType, cooldown: number) => void;
  setActiveSkill: (skillId: SkillType, active: boolean) => void;

  setInventory: (items: InventoryItem[]) => void;
  addItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;

  addEffect: (effect: ActiveEffect) => void;
  removeEffect: (itemId: string) => void;

  setCombo: (combo: ComboState) => void;

  updateAchievement: (achievementId: string, progress: number, completed: boolean) => void;

  incrementGamesPlayed: () => void;
  addToTotalScore: (score: number) => void;
  resetAllData: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Initial state
      player: null,
      savedId: null,
      savedName: '',
      savedColor: '',
      achievements: [],
      totalScore: 0,
      gamesPlayed: 0,
      settings: DEFAULT_SETTINGS,
      guild: null,
      guildInvites: [],
      skillCooldowns: {
        scan: 0,
        shield: 0,
        chain: 0,
        vision: 0,
        mark: 0,
        speed: 0,
      },
      activeSkills: [],
      inventory: [],
      activeEffects: [],
      combo: {
        count: 0,
        multiplier: 1,
        lastRevealTime: 0,
        isFever: false,
      },

      // Player actions
      setPlayer: (player) => {
        console.log('[PlayerStore] setPlayer', player?.id, player?.name);
        if (player) {
          set({
            player,
            inventory: player.items,
            activeEffects: player.activeEffects,
          });
        } else {
          set({ player: null });
        }
      },

      updatePlayer: (updates) => {
        const { player } = get();
        if (player) {
          set({ player: { ...player, ...updates } });
        }
      },

      // Saved data actions
      setSavedData: (id, name, color) => {
        set({
          savedId: id,
          savedName: name,
          savedColor: color,
        });
      },

      setSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      // Guild actions
      setGuild: (guild) => set({ guild }),

      addGuildInvite: (invite) => {
        set((state) => ({
          guildInvites: [
            ...state.guildInvites.filter((i) => i.guildId !== invite.guildId),
            invite,
          ],
        }));
      },

      removeGuildInvite: (guildId) => {
        set((state) => ({
          guildInvites: state.guildInvites.filter((i) => i.guildId !== guildId),
        }));
      },

      // Skill actions
      updateSkillCooldown: (skillId, cooldown) => {
        set((state) => ({
          skillCooldowns: {
            ...state.skillCooldowns,
            [skillId]: cooldown,
          },
        }));
      },

      setActiveSkill: (skillId, active) => {
        set((state) => ({
          activeSkills: active
            ? [...state.activeSkills.filter((s) => s !== skillId), skillId]
            : state.activeSkills.filter((s) => s !== skillId),
        }));
      },

      // Inventory actions
      setInventory: (items) => set({ inventory: items }),

      addItem: (itemId) => {
        set((state) => {
          const existing = state.inventory.find((i) => i.itemId === itemId);
          if (existing) {
            return {
              inventory: state.inventory.map((i) =>
                i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return {
            inventory: [...state.inventory, { itemId: itemId as any, quantity: 1 }],
          };
        });
      },

      removeItem: (itemId) => {
        set((state) => {
          const existing = state.inventory.find((i) => i.itemId === itemId);
          if (existing && existing.quantity > 1) {
            return {
              inventory: state.inventory.map((i) =>
                i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i
              ),
            };
          }
          return {
            inventory: state.inventory.filter((i) => i.itemId !== itemId),
          };
        });
      },

      // Effect actions
      addEffect: (effect) => {
        set((state) => ({
          activeEffects: [
            ...state.activeEffects.filter((e) => e.itemId !== effect.itemId),
            effect,
          ],
        }));

        // Auto-remove when expired
        const duration = effect.endTime - Date.now();
        if (duration > 0) {
          setTimeout(() => {
            get().removeEffect(effect.itemId);
          }, duration);
        }
      },

      removeEffect: (itemId) => {
        set((state) => ({
          activeEffects: state.activeEffects.filter((e) => e.itemId !== itemId),
        }));
      },

      // Combo actions
      setCombo: (combo) => {
        // Defensive: ensure combo is valid
        if (combo && typeof combo.count === 'number') {
          set({ combo });
        } else {
          console.warn('[PlayerStore] Invalid combo received:', combo);
          set({
            combo: {
              count: 0,
              multiplier: 1,
              lastRevealTime: 0,
              isFever: false,
            },
          });
        }
      },

      // Achievement actions
      updateAchievement: (achievementId, progress, completed) => {
        set((state) => {
          const existing = state.achievements.find(
            (a) => a.achievementId === achievementId
          );
          if (existing) {
            return {
              achievements: state.achievements.map((a) =>
                a.achievementId === achievementId
                  ? {
                      ...a,
                      currentValue: progress,
                      completed,
                      completedAt: completed ? Date.now() : undefined,
                    }
                  : a
              ),
            };
          }
          return {
            achievements: [
              ...state.achievements,
              {
                achievementId,
                currentValue: progress,
                completed,
                completedAt: completed ? Date.now() : undefined,
              },
            ],
          };
        });
      },

      // Stats actions
      incrementGamesPlayed: () => {
        set((state) => ({ gamesPlayed: state.gamesPlayed + 1 }));
      },

      addToTotalScore: (score) => {
        set((state) => ({ totalScore: state.totalScore + score }));
      },

      resetAllData: () => {
        // Clear localStorage
        localStorage.removeItem('oh-my-mines-player');

        // Reset store state
        set({
          player: null,
          savedId: null,
          savedName: '',
          savedColor: '',
          achievements: [],
          totalScore: 0,
          gamesPlayed: 0,
          settings: DEFAULT_SETTINGS,
          guild: null,
          guildInvites: [],
          skillCooldowns: {
            scan: 0,
            shield: 0,
            chain: 0,
            vision: 0,
            mark: 0,
            speed: 0,
          },
          activeSkills: [],
          inventory: [],
          activeEffects: [],
          combo: {
            count: 0,
            multiplier: 1,
            lastRevealTime: 0,
            isFever: false,
          },
        });
      },
    }),
    {
      name: 'oh-my-mines-player',
      partialize: (state) => ({
        savedId: state.savedId,
        savedName: state.savedName,
        savedColor: state.savedColor,
        achievements: state.achievements,
        totalScore: state.totalScore,
        gamesPlayed: state.gamesPlayed,
        settings: state.settings,
      }),
    }
  )
);
