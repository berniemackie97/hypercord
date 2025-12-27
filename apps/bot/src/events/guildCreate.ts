import { Events, type Guild } from "discord.js";
import { db } from "../db/index.js";
import { guilds } from "../db/schema.js";
import { log } from "../core/logger.js";

export const name = Events.GuildCreate;
export const once = false;

export async function execute(guild: Guild) {
  try {
    // Insert or update guild in database
    await db
      .insert(guilds)
      .values({
        id: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
        joinedAt: guild.joinedAt || new Date(),
        isActive: true,
        config: {},
      })
      .onConflictDoUpdate({
        target: guilds.id,
        set: {
          name: guild.name,
          ownerId: guild.ownerId,
          isActive: true,
          leftAt: null,
          updatedAt: new Date(),
        },
      });

    log.info(
      {
        guildId: guild.id,
        guildName: guild.name,
        memberCount: guild.memberCount,
      },
      "joined guild"
    );
  } catch (err) {
    log.error({ err, guildId: guild.id }, "failed to track guild join");
  }
}
