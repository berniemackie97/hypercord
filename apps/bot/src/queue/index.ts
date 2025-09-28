// apps/bot/src/queue/index.ts
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { type Client, type GuildTextBasedChannel } from "discord.js";
import { env } from "../core/config.js";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
});

export const queues = {
  example:   new Queue("example",   { connection }),
  reminders: new Queue("reminders", { connection }),
};

function isGuildTextSendable(ch: unknown): ch is GuildTextBasedChannel {
  return !!ch
    && typeof (ch as any).isTextBased === "function"
    && (ch as any).isTextBased()
    && "guildId" in (ch as any);
}

export function startWorkers(client: Client) {
  new Worker(
    "reminders",
    async (job) => {
      const {
        channelId,
        userId,
        what,
        original,
      }: {
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
    },
    { connection },
  );
}
