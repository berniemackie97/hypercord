import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import {
  loggingMiddleware,
  permissionMiddleware,
  guildOnlyMiddleware,
} from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

/**
 * Modlogs command - View moderation history for a user
 *
 * Features:
 * - View last 10 moderation actions for a user
 * - Shows action type, moderator, reason, and timestamp
 * - Permission checks
 * - Rate limited
 */

const optionsSchema = z.object({
  user: schemas.snowflake,
  limit: schemas.nonNegativeInt.min(1).max(25).optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("modlogs")
  .setDescription("View moderation history for a user")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The user to view moderation logs for")
      .setRequired(true)
  )
  .addIntegerOption((o) =>
    o
      .setName("limit")
      .setDescription("Number of logs to show (1-25, default: 10)")
      .setMinValue(1)
      .setMaxValue(25)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ModerateMembers]))
  .use(
    rateLimitMiddleware({
      max: 10,
      window: 60000, // 10 requests per minute
      scope: "user",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId, limit } = getValidatedOptions<z.infer<typeof optionsSchema>>(
      interaction
    );

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const user = await interaction.client.users.fetch(userId);
    const logLimit = limit || 10;

    // Fetch moderation logs from database
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.guildId, guild.id), eq(auditLogs.targetId, user.id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(logLimit);

    if (logs.length === 0) {
      await interaction.editReply({
        content: `ℹ️ No moderation logs found for **${user.tag}**.`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Moderation Logs - ${user.tag}`)
      .setColor(0x5865f2)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(`Showing last ${logs.length} action${logs.length > 1 ? "s" : ""}`)
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    // Add each log as a field
    for (const log of logs) {
      const moderator = await interaction.client.users.fetch(log.moderatorId).catch(() => null);
      const actionEmoji = getActionEmoji(log.action);
      const timestamp = Math.floor(log.createdAt.getTime() / 1000);

      let fieldValue = `**Moderator:** ${moderator ? moderator.tag : `<@${log.moderatorId}>`}\n`;
      fieldValue += `**Time:** <t:${timestamp}:R>\n`;

      if (log.reason) {
        fieldValue += `**Reason:** ${log.reason}\n`;
      }

      // Add metadata if available
      if (log.metadata && typeof log.metadata === "object") {
        const meta = log.metadata as Record<string, any>;
        if (meta.duration) {
          fieldValue += `**Duration:** ${meta.duration} minutes\n`;
        }
        if (meta.deleteDays) {
          fieldValue += `**Messages Deleted:** ${meta.deleteDays} day(s)\n`;
        }
      }

      embed.addFields({
        name: `${actionEmoji} ${formatAction(log.action)} - <t:${timestamp}:f>`,
        value: fieldValue,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();

/**
 * Get emoji for action type
 */
function getActionEmoji(action: string): string {
  const emojiMap: Record<string, string> = {
    ban: "🔨",
    unban: "✅",
    kick: "👢",
    warn: "⚠️",
    timeout: "⏱️",
    note: "📝",
    message_delete: "🗑️",
  };
  return emojiMap[action] || "📌";
}

/**
 * Format action name for display
 */
function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
