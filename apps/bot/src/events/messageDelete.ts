import { Events, type Message } from "discord.js";
import { log } from "../core/logger.js";
import { db } from "../db/index.js";
import { messageCache } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const name = Events.MessageDelete;
export const once = false;

export async function execute(message: Message) {
  // Ignore partial messages or DMs
  if (message.partial) return;
  if (!message.guild) return;

  try {
    // Update messageCache with deletion timestamp
    await db
      .update(messageCache)
      .set({ deletedAt: new Date() })
      .where(eq(messageCache.messageId, message.id));

    log.debug(
      {
        guild: message.guild.id,
        channel: message.channelId,
        messageId: message.id,
        author: message.author?.id,
      },
      "message deleted and cached"
    );
  } catch (err) {
    log.error(
      {
        err,
        guild: message.guild.id,
        messageId: message.id,
      },
      "failed to cache deleted message"
    );
  }
}
