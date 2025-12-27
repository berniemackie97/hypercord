import { Events, type Client } from "discord.js";
import { db } from "../db/index.js";
import { guilds } from "../db/schema.js";
import { log } from "../core/logger.js";
import { queues } from "../queue/index.js";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  // Sync all current guilds to database
  try {
    const guildData = client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      joinedAt: guild.joinedAt || new Date(),
      isActive: true,
      config: {},
    }));

    if (guildData.length > 0) {
      await db
        .insert(guilds)
        .values(guildData)
        .onConflictDoUpdate({
          target: guilds.id,
          set: {
            name: db.raw("excluded.name"),
            ownerId: db.raw("excluded.owner_id"),
            isActive: true,
            leftAt: null,
            updatedAt: new Date(),
          },
        });

      log.info({ count: guildData.length }, "synced guilds to database");
    }
  } catch (err) {
    log.error({ err }, "failed to sync guilds on startup");
  }

  // Schedule daily stats aggregation
  try {
    // Schedule for midnight every day (using cron pattern)
    await queues.dailyStats.add(
      "aggregate",
      { date: new Date().toISOString().split("T")[0] },
      {
        repeat: {
          pattern: "0 0 * * *", // Every day at midnight
        },
        jobId: "daily-stats-aggregation", // Prevents duplicates
      }
    );

    log.info("scheduled daily stats aggregation");
  } catch (err) {
    log.error({ err }, "failed to schedule daily stats aggregation");
  }
}
