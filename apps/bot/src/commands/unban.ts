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
import { createAuditLog } from "../core/audit.js";
import { eq, and } from "drizzle-orm";

/**
 * Unban command - Remove a ban from a user
 *
 * Features:
 * - Unban users from the server
 * - Update database to mark ban as inactive
 * - Permission checks
 * - Rate limited
 * - Audit logging
 */

const optionsSchema = z.object({
  user: schemas.snowflake,
  reason: z.string().max(512, "Reason too long (max 512 chars)").optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Remove a ban from a user")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The user to unban")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("reason")
      .setDescription("Reason for the unban")
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
      window: 60000, // 5 unbans per minute
      scope: "guild",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId, reason } = getValidatedOptions<z.infer<typeof optionsSchema>>(
      interaction
    );

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const user = await interaction.client.users.fetch(userId);

    // Check if user is banned
    try {
      await guild.bans.fetch(user.id);
    } catch {
      await interaction.editReply({
        content: `❌ **${user.tag}** is not banned.`,
      });
      return;
    }

    // Remove the ban from Discord
    await guild.bans.remove(user.id, reason || `Unbanned by ${interaction.user.tag}`);

    // Update ban in database
    try {
      await db
        .update(bans)
        .set({
          isActive: false,
          unbannedAt: new Date(),
        })
        .where(and(eq(bans.userId, user.id), eq(bans.guildId, guild.id), eq(bans.isActive, true)));

      await createAuditLog({
        guildId: guild.id,
        moderatorId: interaction.user.id,
        action: "unban",
        targetId: user.id,
        reason: reason,
      });
    } catch (err) {
      // Log but don't fail the command if database update fails
      console.error("Failed to update ban in database:", err);
    }

    const embed = new EmbedBuilder()
      .setTitle("✅ User Unbanned")
      .setColor(0x00aa00)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "User", value: `${user.tag} (\`${user.id}\`)`, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true },
        { name: "Reason", value: reason || "No reason provided" }
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
