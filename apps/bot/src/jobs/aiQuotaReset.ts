import { Queue, Worker } from "bullmq";
import { log } from "../core/logger.js";
import { db } from "../db/index.js";
import { aiUserAccess } from "../db/schema.js";
import { redisConnection } from "../lib/redis.js";

// Create queue for AI quota resets
export const aiQuotaResetQueue = new Queue("ai-quota-reset", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * AI Quota Reset Worker
 * Resets monthly usage counters on the 1st of each month
 */
export const aiQuotaResetWorker = new Worker(
  "ai-quota-reset",
  async (job) => {
    log.info("Starting monthly AI quota reset");

    try {
      // Reset all user access monthly counters
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
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

// Schedule monthly reset job (runs at 00:00 on the 1st of every month)
export async function scheduleAIQuotaReset() {
  await aiQuotaResetQueue.add(
    "monthly-reset",
    {},
    {
      repeat: {
        pattern: "0 0 1 * *", // Cron: At 00:00 on day-of-month 1
      },
    }
  );

  log.info("AI quota reset job scheduled (monthly on 1st at midnight)");
}

// Handle worker events
aiQuotaResetWorker.on("completed", (job) => {
  log.info({ jobId: job.id }, "AI quota reset job completed");
});

aiQuotaResetWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, error: err }, "AI quota reset job failed");
});
