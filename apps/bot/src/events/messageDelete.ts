import { Events, type Message, type PartialMessage } from "discord.js";
import { log } from "../core/logger.js";
import { db } from "../db/index.js";
import { messageCache } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const name = Events.MessageDelete;
export const once = false;

export async function execute(message: Message | PartialMessage) {
  if (!message.guildId) return;

  try {
    // Update messageCache with deletion timestamp
    await db
      .update(messageCache)
      .set({ deletedAt: new Date() })
      .where(eq(messageCache.messageId, message.id));

    log.debug(
      {
        guild: message.guildId,
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
