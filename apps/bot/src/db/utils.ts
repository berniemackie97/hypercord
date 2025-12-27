import { db } from "./index.js";
import { users, guilds, guildMembers } from "./schema.js";
import type { User, GuildMember } from "discord.js";
import { log } from "../core/logger.js";

/**
 * Ensure a user exists in the database (upsert)
 */
export async function ensureUser(user: User): Promise<void> {
  try {
    await db
      .insert(users)
      .values({
        id: user.id,
        username: user.username,
        globalName: user.globalName,
        isBot: user.bot,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: user.username,
          globalName: user.globalName,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    log.error({ err, userId: user.id }, "failed to ensure user exists");
  }
}

/**
 * Ensure a guild member record exists (upsert)
 */
export async function ensureGuildMember(member: GuildMember): Promise<void> {
  try {
    // First ensure the user exists
    await ensureUser(member.user);

    // Then ensure guild member record
    await db
      .insert(guildMembers)
      .values({
        id: `${member.guild.id}-${member.user.id}`,
        userId: member.user.id,
        guildId: member.guild.id,
        nickname: member.nickname,
        joinedAt: member.joinedAt || new Date(),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [guildMembers.userId, guildMembers.guildId],
        set: {
          nickname: member.nickname,
          isActive: true,
          leftAt: null,
        },
      });
  } catch (err) {
    log.error({ err, userId: member.user.id, guildId: member.guild.id }, "failed to ensure guild member exists");
  }
}
