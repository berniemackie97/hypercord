// apps/bot/src/queue/index.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { type Client, type GuildTextBasedChannel } from "discord.js";
import { env } from "../core/config.js";
import { db } from "../db/index.js";
import { reminders, commandLogs, guilds, guildMembers, dailyStats } from "../db/schema.js";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { log } from "../core/logger.js";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
});

export const queues = {
  example:   new Queue("example",   { connection }),
  reminders: new Queue("reminders", { connection }),
  dailyStats: new Queue("dailyStats", { connection }),
  aiQuotaReset: new Queue("ai-quota-reset", { connection }),
};

function isGuildTextSendable(ch: unknown): ch is GuildTextBasedChannel {
  return !!ch
    && typeof (ch as any).isTextBased === "function"
    && (ch as any).isTextBased()
    && "guildId" in (ch as any);
}

export function startWorkers(client: Client) {
  // AI Quota Reset Worker
  new Worker(
    "ai-quota-reset",
    async (job) => {
      log.info("Starting monthly AI quota reset");

      try {
        const { aiUserAccess } = await import("../db/schema.js");
        const result = await db
          .update(aiUserAccess)
          .set({ usedThisMonth: 0 })
          .returning({ userId: aiUserAccess.userId });

        log.info({ count: result.length }, "AI quotas reset for month");
        return { success: true, usersReset: result.length };
      } catch (error) {
        log.error({ error }, "Failed to reset AI quotas");
        throw error;
      }
    },
    { connection }
  );

  // Schedule monthly AI quota reset (runs on 1st of month at midnight)
  queues.aiQuotaReset.add(
    "monthly-reset",
    {},
    {
      repeat: {
        pattern: "0 0 1 * *", // Cron: At 00:00 on day-of-month 1
      },
    }
  ).then(() => {
    log.info("AI quota reset job scheduled (monthly on 1st at midnight)");
  });

  new Worker(
    "reminders",
    async (job) => {
      const {
        reminderId,
        channelId,
        userId,
        what,
        original,
      }: {
        reminderId: string;
        channelId: string;
        userId: string;
        what: string;
        original?: { appId: string; token: string; createdAt: number };
      } = job.data;

      const mention = `<@${userId}>`;
      const payload = `${mention} ⏰ Reminder: **${what}**`;

      // 1) deliver the reminder
      const ch = await client.channels.fetch(channelId).catch(() => null);
      if (isGuildTextSendable(ch)) {
        await ch.send({ content: payload }).catch(() => {});
      } else {
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) await user.send({ content: payload }).catch(() => {});
      }

      // 2) delete the original ephemeral, if its interaction token is still valid (~15 min)
      try {
        if (original && Date.now() - original.createdAt < 14 * 60 * 1000) {
          await fetch(
            `https://discord.com/api/v10/webhooks/${original.appId}/${original.token}/messages/@original`,
            { method: "DELETE" },
          );
        }
      } catch {
        // best-effort cleanup only
      }

      // 3) mark reminder as completed in database
      try {
        await db
          .update(reminders)
          .set({
            isCompleted: true,
            completedAt: new Date(),
          })
          .where(eq(reminders.id, reminderId));
      } catch (err) {
        console.error("Failed to mark reminder as completed:", err);
      }
    },
    { connection },
  );

  // Daily stats aggregation worker
  new Worker(
    "dailyStats",
    async (job) => {
      const { date }: { date: string } = job.data;
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      try {
        // Count commands executed and failed
        const commandStats = await db
          .select({
            executed: sql<number>`COUNT(*)`,
            failed: sql<number>`SUM(CASE WHEN ${commandLogs.success} = false THEN 1 ELSE 0 END)`,
          })
          .from(commandLogs)
          .where(
            and(
              gte(commandLogs.createdAt, startOfDay),
              lt(commandLogs.createdAt, endOfDay)
            )
          );

        // Count active guilds (guilds with commands executed that day)
        const activeGuildsCount = await db
          .selectDistinct({ guildId: commandLogs.guildId })
          .from(commandLogs)
          .where(
            and(
              gte(commandLogs.createdAt, startOfDay),
              lt(commandLogs.createdAt, endOfDay)
            )
          );

        // Count active users (users who executed commands that day)
        const activeUsersCount = await db
          .selectDistinct({ userId: commandLogs.userId })
          .from(commandLogs)
          .where(
            and(
              gte(commandLogs.createdAt, startOfDay),
              lt(commandLogs.createdAt, endOfDay)
            )
          );

        const stats = commandStats[0] || { executed: 0, failed: 0 };

        // Insert daily stats
        await db
          .insert(dailyStats)
          .values({
            id: nanoid(),
            date: targetDate,
            commandsExecuted: Number(stats.executed) || 0,
            commandsFailed: Number(stats.failed) || 0,
            guildsActive: activeGuildsCount.length,
            usersActive: activeUsersCount.length,
            messagesProcessed: 0, // Can be tracked separately if needed
          })
          .onConflictDoUpdate({
            target: dailyStats.date,
            set: {
              commandsExecuted: Number(stats.executed) || 0,
              commandsFailed: Number(stats.failed) || 0,
              guildsActive: activeGuildsCount.length,
              usersActive: activeUsersCount.length,
              updatedAt: new Date(),
            },
          });

        log.info(
          {
            date: date,
            commandsExecuted: stats.executed,
            commandsFailed: stats.failed,
            guildsActive: activeGuildsCount.length,
            usersActive: activeUsersCount.length,
          },
          "daily stats aggregated"
        );
      } catch (err) {
        log.error({ err, date }, "failed to aggregate daily stats");
        throw err;
      }
    },
    { connection },
  );
}
