import { v4 as uuidv4 } from 'uuid';
import {
  Guild,
  GuildBuff,
  GuildInvite,
  ChunkCoord,
} from 'shared';
import { GUILD_BUFFS, GUILD_CONSTRAINTS } from 'shared';
import { PlayerManager } from './Player.js';

export class GuildManager {
  private guilds: Map<string, Guild> = new Map();
  private invites: Map<string, GuildInvite[]> = new Map(); // playerId -> invites

  constructor(private playerManager: PlayerManager) {}

  createGuild(
    leaderId: string,
    name: string,
    tag: string,
    color: string
  ): { success: boolean; guild?: Guild; error?: string } {
    // Validate name
    if (name.length < GUILD_CONSTRAINTS.MIN_NAME_LENGTH ||
        name.length > GUILD_CONSTRAINTS.MAX_NAME_LENGTH) {
      return { success: false, error: 'Invalid guild name length' };
    }

    // Validate tag
    if (tag.length < GUILD_CONSTRAINTS.TAG_LENGTH_MIN ||
        tag.length > GUILD_CONSTRAINTS.TAG_LENGTH_MAX) {
      return { success: false, error: 'Invalid tag length' };
    }

    // Check if player already in a guild
    const player = this.playerManager.getPlayer(leaderId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }
    if (player.guildId) {
      return { success: false, error: 'Already in a guild' };
    }

    // Check for duplicate name/tag
    for (const guild of this.guilds.values()) {
      if (guild.name.toLowerCase() === name.toLowerCase()) {
        return { success: false, error: 'Guild name already taken' };
      }
      if (guild.tag.toLowerCase() === tag.toLowerCase()) {
        return { success: false, error: 'Guild tag already taken' };
      }
    }

    const guild: Guild = {
      id: uuidv4(),
      name,
      tag: tag.toUpperCase(),
      color,
      leaderId,
      memberIds: [leaderId],
      score: 0,
      createdAt: Date.now(),
      chunksOwned: [],
    };

    this.guilds.set(guild.id, guild);
    this.playerManager.setGuild(leaderId, guild.id);

    return { success: true, guild };
  }

  getGuild(guildId: string): Guild | undefined {
    return this.guilds.get(guildId);
  }

  getGuildByPlayer(playerId: string): Guild | undefined {
    const player = this.playerManager.getPlayer(playerId);
    if (!player?.guildId) return undefined;
    return this.guilds.get(player.guildId);
  }

  joinGuild(playerId: string, guildId: string): { success: boolean; error?: string } {
    const player = this.playerManager.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }
    if (player.guildId) {
      return { success: false, error: 'Already in a guild' };
    }

    const guild = this.guilds.get(guildId);
    if (!guild) {
      return { success: false, error: 'Guild not found' };
    }

    if (guild.memberIds.length >= GUILD_CONSTRAINTS.MAX_MEMBERS) {
      return { success: false, error: 'Guild is full' };
    }

    guild.memberIds.push(playerId);
    this.playerManager.setGuild(playerId, guildId);

    // Remove any pending invites
    this.invites.delete(playerId);

    return { success: true };
  }

  leaveGuild(playerId: string): { success: boolean; error?: string; disbanded?: boolean } {
    const player = this.playerManager.getPlayer(playerId);
    if (!player?.guildId) {
      return { success: false, error: 'Not in a guild' };
    }

    const guild = this.guilds.get(player.guildId);
    if (!guild) {
      return { success: false, error: 'Guild not found' };
    }

    // Remove from members
    guild.memberIds = guild.memberIds.filter(id => id !== playerId);
    this.playerManager.setGuild(playerId, undefined);

    // If leader left, transfer leadership or disband
    if (guild.leaderId === playerId) {
      if (guild.memberIds.length > 0) {
        guild.leaderId = guild.memberIds[0];
      } else {
        // Disband guild
        this.guilds.delete(guild.id);
        return { success: true, disbanded: true };
      }
    }

    return { success: true };
  }

  kickMember(leaderId: string, playerId: string): { success: boolean; error?: string } {
    const guild = this.getGuildByPlayer(leaderId);
    if (!guild) {
      return { success: false, error: 'Not in a guild' };
    }

    if (guild.leaderId !== leaderId) {
      return { success: false, error: 'Only leader can kick members' };
    }

    if (leaderId === playerId) {
      return { success: false, error: 'Cannot kick yourself' };
    }

    if (!guild.memberIds.includes(playerId)) {
      return { success: false, error: 'Player not in guild' };
    }

    guild.memberIds = guild.memberIds.filter(id => id !== playerId);
    this.playerManager.setGuild(playerId, undefined);

    return { success: true };
  }

  invitePlayer(inviterId: string, playerId: string): { success: boolean; invite?: GuildInvite; error?: string } {
    const guild = this.getGuildByPlayer(inviterId);
    if (!guild) {
      return { success: false, error: 'Not in a guild' };
    }

    const targetPlayer = this.playerManager.getPlayer(playerId);
    if (!targetPlayer) {
      return { success: false, error: 'Player not found' };
    }

    if (targetPlayer.guildId) {
      return { success: false, error: 'Player already in a guild' };
    }

    const inviter = this.playerManager.getPlayer(inviterId);
    if (!inviter) {
      return { success: false, error: 'Inviter not found' };
    }

    const invite: GuildInvite = {
      guildId: guild.id,
      guildName: guild.name,
      inviterId,
      inviterName: inviter.name,
      timestamp: Date.now(),
    };

    // Add to player's invites
    const playerInvites = this.invites.get(playerId) || [];
    // Remove existing invite from same guild
    const filtered = playerInvites.filter(i => i.guildId !== guild.id);
    filtered.push(invite);
    this.invites.set(playerId, filtered);

    return { success: true, invite };
  }

  getInvites(playerId: string): GuildInvite[] {
    return this.invites.get(playerId) || [];
  }

  declineInvite(playerId: string, guildId: string): void {
    const playerInvites = this.invites.get(playerId);
    if (playerInvites) {
      this.invites.set(
        playerId,
        playerInvites.filter(i => i.guildId !== guildId)
      );
    }
  }

  // Get current guild buff based on member count
  getGuildBuff(guildId: string): GuildBuff {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      return { minMembers: 0, scoreBonus: 0, cooldownReduction: 0, itemDropBonus: 0 };
    }

    const memberCount = guild.memberIds.length;
    let activeBuff: GuildBuff = { minMembers: 0, scoreBonus: 0, cooldownReduction: 0, itemDropBonus: 0 };

    for (const buff of GUILD_BUFFS) {
      if (memberCount >= buff.minMembers) {
        // Accumulate buffs
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

  // Update guild score from members
  updateGuildScore(guildId: string): void {
    const guild = this.guilds.get(guildId);
    if (!guild) return;

    let totalScore = 0;
    for (const memberId of guild.memberIds) {
      const player = this.playerManager.getPlayer(memberId);
      if (player) {
        totalScore += player.score;
      }
    }
    guild.score = totalScore;
  }

  // Claim a chunk for a guild
  claimChunk(guildId: string, coord: ChunkCoord): void {
    const guild = this.guilds.get(guildId);
    if (!guild) return;

    // Remove from other guild
    for (const g of this.guilds.values()) {
      g.chunksOwned = g.chunksOwned.filter(
        c => c.cx !== coord.cx || c.cy !== coord.cy
      );
    }

    // Add to this guild
    if (!guild.chunksOwned.some(c => c.cx === coord.cx && c.cy === coord.cy)) {
      guild.chunksOwned.push(coord);
    }
  }

  getAllGuilds(): Guild[] {
    return Array.from(this.guilds.values());
  }

  getGuildLeaderboard(limit: number = 10): Guild[] {
    return this.getAllGuilds()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getMemberCount(guildId: string): number {
    return this.guilds.get(guildId)?.memberIds.length ?? 0;
  }

  // Reset for new session (keep guilds but reset scores)
  resetForNewSession(): void {
    for (const guild of this.guilds.values()) {
      guild.score = 0;
      guild.chunksOwned = [];
    }
  }
}
