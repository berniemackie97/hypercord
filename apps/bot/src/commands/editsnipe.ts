import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";
import { messageCache } from "../db/schema.js";
import { eq, and, isNotNull, desc } from "drizzle-orm";

const commandData = new SlashCommandBuilder()
  .setName("editsnipe")
  .setDescription("View the last edited message in this channel");

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(rateLimitMiddleware({ max: 5, window: 60000, scope: "user" }))
  .setHandler(async (interaction) => {
    await interaction.deferReply();

    const lastEdited = await db
      .select()
      .from(messageCache)
      .where(and(eq(messageCache.channelId, interaction.channel!.id), isNotNull(messageCache.editedAt)))
      .orderBy(desc(messageCache.editedAt))
      .limit(1);

    if (lastEdited.length === 0) {
      await interaction.editReply({ content: "No recently edited messages found in this channel!" });
      return;
    }

    const msg = lastEdited[0];
    const author = await interaction.client.users.fetch(msg.authorId).catch(() => null);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: author?.tag || "Unknown User",
        iconURL: author?.displayAvatarURL(),
      })
      .addFields(
        { name: "Original", value: msg.content || "*No content*", inline: false },
        { name: "Edited", value: msg.editedContent || "*No content*", inline: false }
      )
      .setColor(0xffa500)
      .setFooter({ text: "Edited" })
      .setTimestamp(msg.editedAt);

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
