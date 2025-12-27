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
import { bans } from "../db/schema.js";
import { ensureUser } from "../db/utils.js";
import { createAuditLog } from "../core/audit.js";
import { nanoid } from "nanoid";

/**
 * Ban command - Permanently ban a member from the server
 *
 * Features:
 * - Ban members with optional reason
 * - Delete message history (0-7 days)
 * - Permission checks
 * - Rate limited
 * - Audit logging
 */

const optionsSchema = z.object({
  user: schemas.snowflake,
  reason: z.string().max(512, "Reason too long (max 512 chars)").optional(),
  "delete-days": schemas.nonNegativeInt.max(7, "Delete days must be between 0 and 7").optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a member from the server")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The member to ban")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("reason")
      .setDescription("Reason for the ban")
      .setRequired(false)
  )
  .addIntegerOption((o) =>
    o
      .setName("delete-days")
      .setDescription("Days of messages to delete (0-7)")
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.BanMembers]))
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 60000, // 5 bans per minute
      scope: "guild",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId, reason, "delete-days": deleteDays } = getValidatedOptions<
      z.infer<typeof optionsSchema>
    >(interaction);

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const user = await interaction.client.users.fetch(userId);

    // Check if user is already banned
    try {
      const existingBan = await guild.bans.fetch(user.id);
      if (existingBan) {
        await interaction.editReply({
          content: `❌ **${user.tag}** is already banned.`,
        });
        return;
      }
    } catch {
      // User is not banned, continue
    }

    // Check role hierarchy
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const executor = await guild.members.fetch(interaction.user.id);
      if (member.roles.highest.position >= executor.roles.highest.position) {
        await interaction.editReply({
          content: `❌ You cannot ban **${user.tag}** due to role hierarchy.`,
        });
        return;
      }
    }

    // Try to DM the user before banning
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle("🔨 You have been banned")
        .setDescription(`You were banned from **${guild.name}**`)
        .setColor(0xff0000)
        .addFields({
          name: "Reason",
          value: reason || "No reason provided",
        })
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch {
      // User has DMs disabled or blocked the bot
    }

    // Execute the ban
    await guild.bans.create(user.id, {
      reason: reason || `Banned by ${interaction.user.tag}`,
      deleteMessageSeconds: (deleteDays || 0) * 86400,
    });

    // Save ban to database and audit log
    try {
      await ensureUser(user);
      await db.insert(bans).values({
        id: nanoid(),
        userId: user.id,
        guildId: guild.id,
        moderatorId: interaction.user.id,
        reason: reason || "No reason provided",
        isActive: true,
      });

      await createAuditLog({
        guildId: guild.id,
        moderatorId: interaction.user.id,
        action: "ban",
        targetId: user.id,
        reason: reason,
        metadata: {
          deleteDays,
        },
      });
    } catch (err) {
      // Log but don't fail the command if database insert fails
      console.error("Failed to save ban to database:", err);
    }

    const embed = new EmbedBuilder()
      .setTitle("🔨 Member Banned")
      .setColor(0xff0000)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "User", value: `${user.tag} (\`${user.id}\`)`, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true },
        { name: "Reason", value: reason || "No reason provided" }
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    if (deleteDays && deleteDays > 0) {
      embed.addFields({
        name: "Messages Deleted",
        value: `Last ${deleteDays} day${deleteDays > 1 ? "s" : ""}`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
