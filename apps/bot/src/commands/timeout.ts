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
import { createAuditLog } from "../core/audit.js";

/**
 * Timeout command - Temporarily mute a member using Discord's native timeout
 *
 * Features:
 * - Timeout members for a specified duration
 * - Max 28 days (Discord limit)
 * - Permission checks and role hierarchy
 * - Rate limited
 * - Audit logging
 */

const optionsSchema = z.object({
  user: schemas.snowflake,
  duration: z.string().min(1, "Duration cannot be empty"),
  reason: z.string().max(512, "Reason too long (max 512 chars)").optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("timeout")
  .setDescription("Timeout a member (Discord native timeout)")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The member to timeout")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("duration")
      .setDescription("Duration (e.g., 10m, 2h, 1d)")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("reason")
      .setDescription("Reason for the timeout")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

function parseDuration(input: string): number | null {
  const match = /^(\d+)([smhd])$/i.exec(input.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const ms = amount * (multipliers[unit] || 0);

  // Discord timeout max is 28 days
  const maxDuration = 28 * 24 * 60 * 60 * 1000;
  if (ms > maxDuration) return null;

  return ms;
}

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ModerateMembers]))
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 60000, // 5 timeouts per minute
      scope: "guild",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId, duration, reason } = getValidatedOptions<
      z.infer<typeof optionsSchema>
    >(interaction);

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member) {
      await interaction.editReply({
        content: "❌ User is not a member of this server.",
      });
      return;
    }

    // Check if member is already timed out
    if (member.isCommunicationDisabled()) {
      await interaction.editReply({
        content: `❌ **${member.user.tag}** is already timed out.`,
      });
      return;
    }

    // Parse duration
    const durationMs = parseDuration(duration);
    if (!durationMs) {
      await interaction.editReply({
        content: "❌ Invalid duration. Use: `10m`, `2h`, `1d` (max 28 days).",
      });
      return;
    }

    // Check if member is moderatable
    if (!member.moderatable) {
      await interaction.editReply({
        content: `❌ Cannot timeout **${member.user.tag}** (missing permissions or role hierarchy).`,
      });
      return;
    }

    // Check role hierarchy
    const executor = await guild.members.fetch(interaction.user.id);
    if (member.roles.highest.position >= executor.roles.highest.position) {
      await interaction.editReply({
        content: `❌ You cannot timeout **${member.user.tag}** due to role hierarchy.`,
      });
      return;
    }

    // Execute the timeout
    await member.timeout(durationMs, reason || `Timed out by ${interaction.user.tag}`);

    // Audit log
    try {
      await createAuditLog({
        guildId: guild.id,
        moderatorId: interaction.user.id,
        action: "timeout",
        targetId: member.user.id,
        reason,
        metadata: {
          duration: durationMs,
          expiresAt: new Date(Date.now() + durationMs).toISOString(),
        },
      });
    } catch (err) {
      console.error("Failed to create audit log:", err);
    }

    const expiresAt = new Date(Date.now() + durationMs);
    const embed = new EmbedBuilder()
      .setTitle("⏱️ Member Timed Out")
      .setColor(0xff6b00)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: "User", value: `${member.user.tag} (\`${member.user.id}\`)`, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true },
        { name: "Duration", value: duration, inline: true },
        { name: "Expires", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` },
        { name: "Reason", value: reason || "No reason provided" }
      )
      .setFooter({ text: `User ID: ${member.user.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
