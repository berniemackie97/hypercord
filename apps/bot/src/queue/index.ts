import { Queue, Worker } from "bullmq";
import type { Client } from "discord.js";
import IORedis from "ioredis";
import { env } from "../core/config.js";
import { log } from "../core/logger.js";
import { resetAiQuotas } from "./processors/aiQuotaReset.js";
import { deliverReminder } from "./processors/reminder.js";
import { aggregateDailyStats } from "./processors/dailyStats.js";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const queues = {
  example: new Queue("example", { connection }),
  reminders: new Queue("reminders", { connection }),
  dailyStats: new Queue("dailyStats", { connection }),
  aiQuotaReset: new Queue("ai-quota-reset", { connection }),
};

const workers: Worker[] = [];
let workersStarted = false;

export async function startWorkers(client: Client): Promise<void> {
  if (workersStarted) {
    throw new Error("Background workers already started");
  }
  workersStarted = true;

  workers.push(new Worker("ai-quota-reset", resetAiQuotas, { connection }));
  workers.push(new Worker("reminders", (job) => deliverReminder(job, client), { connection }));
  workers.push(new Worker("dailyStats", aggregateDailyStats, { connection }));

  for (const worker of workers) {
    worker.on("error", (error) => {
      log.error({ error, queue: worker.name }, "background worker connection error");
    });
  }

  await queues.aiQuotaReset.add("monthly-reset", {}, {
    repeat: { pattern: "0 0 1 * *" },
  });
  log.info("monthly AI quota reset scheduled");
}

export async function stopWorkers(): Promise<void> {
  const results = await Promise.allSettled(workers.map((worker) => worker.close()));
  workers.length = 0;
  workersStarted = false;

  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
  if (failures.length > 0) {
    throw new AggregateError(failures, "Failed to drain background workers");
  }
}

export async function closeQueues(): Promise<void> {
  const results = await Promise.allSettled(Object.values(queues).map((queue) => queue.close()));
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );

  try {
    await connection.quit();
  } catch (error) {
    failures.push(error);
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, "Failed to close queue connections");
  }
}
