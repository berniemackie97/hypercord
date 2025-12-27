import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";
import { messageCache } from "../db/schema.js";
import { eq, and, isNotNull, desc } from "drizzle-orm";

const commandData = new SlashCommandBuilder()
  .setName("snipe")
  .setDescription("View the last deleted message in this channel");

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(rateLimitMiddleware({ max: 5, window: 60000, scope: "user" }))
  .setHandler(async (interaction) => {
    await interaction.deferReply();

    const lastDeleted = await db
      .select()
      .from(messageCache)
      .where(and(eq(messageCache.channelId, interaction.channel!.id), isNotNull(messageCache.deletedAt)))
      .orderBy(desc(messageCache.deletedAt))
      .limit(1);

    if (lastDeleted.length === 0) {
      await interaction.editReply({ content: "No recently deleted messages found in this channel!" });
      return;
    }

    const msg = lastDeleted[0];
    const author = await interaction.client.users.fetch(msg.authorId).catch(() => null);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: author?.tag || "Unknown User",
        iconURL: author?.displayAvatarURL(),
      })
      .setDescription(msg.content || "*No content*")
      .setColor(0xff6b6b)
      .setFooter({ text: "Deleted" })
      .setTimestamp(msg.deletedAt);

    if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      embed.addFields({ name: "Attachments", value: (msg.attachments as any[]).map((a: any) => a.url).join("\n") });
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
