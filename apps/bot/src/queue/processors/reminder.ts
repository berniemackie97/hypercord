import type { Job } from "bullmq";
import type { Client, GuildTextBasedChannel } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { reminders } from "../../db/schema.js";
import { log } from "../../core/logger.js";

interface ReminderData {
  reminderId: string;
  channelId: string;
  userId: string;
  what: string;
  original?: { appId: string; token: string; createdAt: number };
}

function isGuildTextSendable(channel: unknown): channel is GuildTextBasedChannel {
  return channel !== null
    && typeof channel === "object"
    && "guildId" in channel
    && "send" in channel
    && typeof channel.send === "function";
}

export async function deliverReminder(job: Job<ReminderData>, client: Client): Promise<void> {
  const { reminderId, channelId, userId, what, original } = job.data;
  const content = `<@${userId}> ⏰ Reminder: **${what}**`;
  const message = { content, allowedMentions: { users: [userId], parse: [] as const } };

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (isGuildTextSendable(channel)) {
    await channel.send(message);
  } else {
    const user = await client.users.fetch(userId);
    await user.send(message);
  }

  await db
    .update(reminders)
    .set({ isCompleted: true, completedAt: new Date() })
    .where(eq(reminders.id, reminderId));

  if (original && Date.now() - original.createdAt < 14 * 60 * 1000) {
    try {
      await fetch(
        `https://discord.com/api/v10/webhooks/${original.appId}/${original.token}/messages/@original`,
        { method: "DELETE" },
      );
    } catch {
      log.warn({ reminderId }, "unable to delete original reminder response");
    }
  }
}
