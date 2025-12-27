import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type TextChannel,
} from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import {
  loggingMiddleware,
  permissionMiddleware,
  guildOnlyMiddleware,
} from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { createAuditLog } from "../core/audit.js";

/**
 * Purge command - Bulk delete messages
 *
 * Features:
 * - Delete up to 100 messages at once
 * - Optional user filter
 * - Can only delete messages <14 days old (Discord limitation)
 * - Permission checks
 * - Rate limited
 * - Audit logging
 */

const optionsSchema = z.object({
  amount: schemas.nonNegativeInt.min(1, "Amount must be at least 1").max(100, "Amount cannot exceed 100"),
  user: schemas.snowflake.optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Bulk delete messages in the current channel")
  .addIntegerOption((o) =>
    o
      .setName("amount")
      .setDescription("Number of messages to delete (1-100)")
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(true)
  )
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("Only delete messages from this user")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ManageMessages]))
  .use(
    rateLimitMiddleware({
      max: 3,
      window: 60000, // 3 purges per minute
      scope: "guild",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { amount, user: userId } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || !(channel instanceof TextChannel)) {
      await interaction.editReply({
        content: "❌ This command can only be used in text channels.",
      });
      return;
    }

    try {
      // Fetch messages
      const fetchedMessages = await channel.messages.fetch({ limit: amount });

      // Filter by user if specified
      let messagesToDelete = fetchedMessages;
      if (userId) {
        messagesToDelete = fetchedMessages.filter((msg) => msg.author.id === userId);
      }

      // Filter out messages older than 14 days (Discord limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const validMessages = messagesToDelete.filter(
        (msg) => msg.createdTimestamp > twoWeeksAgo
      );

      if (validMessages.size === 0) {
        await interaction.editReply({
          content: "❌ No messages found to delete (messages must be less than 14 days old).",
        });
        return;
      }

      // Bulk delete
      const deleted = await channel.bulkDelete(validMessages, true);

      // Audit log
      try {
        await createAuditLog({
          guildId: interaction.guildId!,
          moderatorId: interaction.user.id,
          action: "message_delete",
          targetId: channel.id,
          reason: `Purged ${deleted.size} messages`,
          metadata: {
            amount: deleted.size,
            userId,
            channelId: channel.id,
          },
        });
      } catch (err) {
        console.error("Failed to create audit log:", err);
      }

      const embed = new EmbedBuilder()
        .setTitle("🗑️ Messages Purged")
        .setColor(0x00aa00)
        .addFields(
          { name: "Amount", value: deleted.size.toString(), inline: true },
          { name: "Channel", value: `<#${channel.id}>`, inline: true },
          { name: "Moderator", value: interaction.user.tag, inline: true }
        )
        .setTimestamp();

      if (userId) {
        const user = await interaction.client.users.fetch(userId);
        embed.addFields({
          name: "Filter",
          value: `Messages from ${user.tag}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Auto-delete the confirmation after 5 seconds
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch {
          // Ignore if already deleted
        }
      }, 5000);
    } catch (err) {
      console.error("Purge error:", err);
      await interaction.editReply({
        content: "❌ Failed to purge messages. Make sure the bot has the `Manage Messages` permission.",
      });
    }
  })
  .build();
