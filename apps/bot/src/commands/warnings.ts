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
import { warnings } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

/**
 * Warnings command - View warning history for a user
 *
 * Features:
 * - View all warnings for a user (active and expired)
 * - Optional filter for active warnings only
 * - Shows moderator, reason, and timestamp
 * - Shows expiration status
 * - Permission checks
 * - Rate limited
 */

const optionsSchema = z.object({
  user: schemas.snowflake,
  "active-only": z.boolean().optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("warnings")
  .setDescription("View warning history for a user")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The user to view warnings for")
      .setRequired(true)
  )
  .addBooleanOption((o) =>
    o
      .setName("active-only")
      .setDescription("Show only active warnings (default: false)")
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
    const { user: userId, "active-only": activeOnly } = getValidatedOptions<
      z.infer<typeof optionsSchema>
    >(interaction);

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const user = await interaction.client.users.fetch(userId);

    // Build query conditions
    const conditions = [eq(warnings.guildId, guild.id), eq(warnings.userId, user.id)];

    if (activeOnly) {
      conditions.push(eq(warnings.isActive, true));
    }

    // Fetch warnings from database
    const userWarnings = await db
      .select()
      .from(warnings)
      .where(and(...conditions))
      .orderBy(desc(warnings.createdAt));

    if (userWarnings.length === 0) {
      await interaction.editReply({
        content: `ℹ️ No ${activeOnly ? "active " : ""}warnings found for **${user.tag}**.`,
      });
      return;
    }

    const activeCount = userWarnings.filter((w) => w.isActive).length;
    const expiredCount = userWarnings.length - activeCount;

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warnings - ${user.tag}`)
      .setColor(activeCount > 0 ? 0xffaa00 : 0x888888)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(
        `**Active:** ${activeCount} | **Expired:** ${expiredCount} | **Total:** ${userWarnings.length}`
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    // Add each warning as a field
    for (const warning of userWarnings) {
      const moderator = await interaction.client.users.fetch(warning.moderatorId).catch(() => null);
      const timestamp = Math.floor(warning.createdAt.getTime() / 1000);

      let fieldValue = `**Moderator:** ${moderator ? moderator.tag : `<@${warning.moderatorId}>`}\n`;
      fieldValue += `**Reason:** ${warning.reason}\n`;
      fieldValue += `**Date:** <t:${timestamp}:F> (<t:${timestamp}:R>)\n`;

      // Show expiration info
      if (warning.expiresAt) {
        const expiryTimestamp = Math.floor(warning.expiresAt.getTime() / 1000);
        const isExpired = warning.expiresAt < new Date();
        fieldValue += `**Expires:** <t:${expiryTimestamp}:R>`;
        if (isExpired) {
          fieldValue += " ✅ (Expired)";
        }
      } else {
        fieldValue += `**Expires:** Never`;
      }

      const statusEmoji = warning.isActive ? "🔴" : "⚫";

      embed.addFields({
        name: `${statusEmoji} Warning #${warning.id.slice(-8)}`,
        value: fieldValue,
        inline: false,
      });
    }

    // Add note about warning threshold
    if (activeCount > 0) {
      const guildConfig = await db.query.guilds.findFirst({
        where: eq(warnings.guildId, guild.id),
      });

      const maxWarnings = (guildConfig?.config as any)?.maxWarnings || 3;

      if (activeCount >= maxWarnings) {
        embed.addFields({
          name: "⚠️ Warning Threshold Reached",
          value: `This user has reached or exceeded the warning threshold of ${maxWarnings}.`,
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
