import { Events, type Guild } from "discord.js";
import { db } from "../db/index.js";
import { guilds } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { log } from "../core/logger.js";

export const name = Events.GuildDelete;
export const once = false;

export async function execute(guild: Guild) {
  try {
    // Mark guild as inactive (soft delete)
    await db
      .update(guilds)
      .set({
        isActive: false,
        leftAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guild.id));

    log.info(
      {
        guildId: guild.id,
        guildName: guild.name,
      },
      "left guild"
    );
  } catch (err) {
    log.error({ err, guildId: guild.id }, "failed to track guild leave");
  }
}
