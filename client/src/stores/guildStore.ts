import { create } from 'zustand';
import type { Guild, GuildInvite, GuildBuff } from 'shared';
import { GUILD_BUFFS } from 'shared';

interface GuildState {
  // Current guild
  currentGuild: Guild | null;

  // All guilds (for browsing)
  guilds: Guild[];

  // Pending invites
  invites: GuildInvite[];

  // Computed buff
  currentBuff: GuildBuff;

  // UI state
  isCreateModalOpen: boolean;
  isGuildPanelOpen: boolean;

  // Actions
  setCurrentGuild: (guild: Guild | null) => void;
  setGuilds: (guilds: Guild[]) => void;
  updateGuild: (guild: Guild) => void;

  addInvite: (invite: GuildInvite) => void;
  removeInvite: (guildId: string) => void;
  clearInvites: () => void;

  setCreateModalOpen: (open: boolean) => void;
  setGuildPanelOpen: (open: boolean) => void;
}

function calculateBuff(memberCount: number): GuildBuff {
  let activeBuff: GuildBuff = {
    minMembers: 0,
    scoreBonus: 0,
    cooldownReduction: 0,
    itemDropBonus: 0,
  };

  for (const buff of GUILD_BUFFS) {
    if (memberCount >= buff.minMembers) {
      activeBuff = {
        minMembers: buff.minMembers,
        scoreBonus: activeBuff.scoreBonus + buff.scoreBonus,
        cooldownReduction: activeBuff.cooldownReduction + buff.cooldownReduction,
        itemDropBonus: activeBuff.itemDropBonus + buff.itemDropBonus,
      };
    }
  }

  return activeBuff;
}

export const useGuildStore = create<GuildState>((set, get) => ({
  // Initial state
  currentGuild: null,
  guilds: [],
  invites: [],
  currentBuff: { minMembers: 0, scoreBonus: 0, cooldownReduction: 0, itemDropBonus: 0 },
  isCreateModalOpen: false,
  isGuildPanelOpen: false,

  // Guild actions
  setCurrentGuild: (guild) => {
    const buff = guild ? calculateBuff(guild.memberIds.length) : {
      minMembers: 0,
      scoreBonus: 0,
      cooldownReduction: 0,
      itemDropBonus: 0,
    };
    set({ currentGuild: guild, currentBuff: buff });
  },

  setGuilds: (guilds) => set({ guilds }),

  updateGuild: (guild) => {
    const { currentGuild, guilds } = get();

    // Update guilds list
    const newGuilds = guilds.map((g) => (g.id === guild.id ? guild : g));
    if (!guilds.find((g) => g.id === guild.id)) {
      newGuilds.push(guild);
    }

    // Update current guild if it's the same
    if (currentGuild?.id === guild.id) {
      const buff = calculateBuff(guild.memberIds.length);
      set({ currentGuild: guild, currentBuff: buff, guilds: newGuilds });
    } else {
      set({ guilds: newGuilds });
    }
  },

  // Invite actions
  addInvite: (invite) => {
    set((state) => ({
      invites: [
        ...state.invites.filter((i) => i.guildId !== invite.guildId),
        invite,
      ],
    }));
  },

  removeInvite: (guildId) => {
    set((state) => ({
      invites: state.invites.filter((i) => i.guildId !== guildId),
    }));
  },

  clearInvites: () => set({ invites: [] }),

  // UI actions
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setGuildPanelOpen: (open) => set({ isGuildPanelOpen: open }),
}));
