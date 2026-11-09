import type { Job } from "bullmq";
import { and, gte, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../db/index.js";
import { commandLogs, dailyStats } from "../../db/schema.js";
import { log } from "../../core/logger.js";

export async function aggregateDailyStats(job: Job<{ date: string }>): Promise<void> {
  const start = new Date(`${job.data.date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid aggregation date");
  }
  const end = new Date(start.getTime() + 86400000);
  const window = and(gte(commandLogs.createdAt, start), lt(commandLogs.createdAt, end));

  const [counts, activeGuilds, activeUsers] = await Promise.all([
    db.select({
      executed: sql<number>`COUNT(*)`,
      failed: sql<number>`SUM(CASE WHEN ${commandLogs.success} = false THEN 1 ELSE 0 END)`,
    }).from(commandLogs).where(window),
    db.selectDistinct({ guildId: commandLogs.guildId }).from(commandLogs).where(window),
    db.selectDistinct({ userId: commandLogs.userId }).from(commandLogs).where(window),
  ]);

  const commandsExecuted = Number(counts[0]?.executed ?? 0);
  const commandsFailed = Number(counts[0]?.failed ?? 0);
  await db.insert(dailyStats).values({
    id: nanoid(),
    date: job.data.date,
    commandsExecuted,
    commandsFailed,
    guildsActive: activeGuilds.length,
    usersActive: activeUsers.length,
    messagesProcessed: 0,
  }).onConflictDoUpdate({
    target: dailyStats.date,
    set: {
      commandsExecuted,
      commandsFailed,
      guildsActive: activeGuilds.length,
      usersActive: activeUsers.length,
      updatedAt: new Date(),
    },
  });

  log.info({ date: job.data.date, commandsExecuted, commandsFailed }, "daily statistics aggregated");
}
