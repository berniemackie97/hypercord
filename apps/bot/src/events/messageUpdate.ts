import { Events, type Message } from "discord.js";
import { log } from "../core/logger.js";
import { db } from "../db/index.js";
import { messageCache } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const name = Events.MessageUpdate;
export const once = false;

export async function execute(oldMessage: Message, newMessage: Message) {
  // Ignore partial messages or DMs
  if (oldMessage.partial || newMessage.partial) return;
  if (!newMessage.guild) return;

  // Ignore if content didn't change
  if (oldMessage.content === newMessage.content) return;

  try {
    // Update messageCache with edited content
    await db
      .update(messageCache)
      .set({
        editedContent: newMessage.content,
        editedAt: new Date(),
      })
      .where(eq(messageCache.messageId, newMessage.id));

    log.debug(
      {
        guild: newMessage.guild.id,
        channel: newMessage.channelId,
        messageId: newMessage.id,
        author: newMessage.author?.id,
      },
      "message edit cached"
    );
  } catch (err) {
    log.error(
      {
        err,
        guild: newMessage.guild.id,
        messageId: newMessage.id,
      },
      "failed to cache edited message"
    );
  }
}
