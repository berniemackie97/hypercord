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
import { ensureUser } from "../db/utils.js";
import { createAuditLog } from "../core/audit.js";
import { nanoid } from "nanoid";

/**
 * Warn command - Issue a warning to a member
 *
 * Features:
 * - Warn members with reason
 * - Optional expiration time
 * - Permission checks
 * - Rate limited
 * - Saves to database + audit log
 */

const optionsSchema = z.object({
  user: schemas.snowflake,
  reason: z.string().min(1, "Reason cannot be empty").max(512, "Reason too long (max 512 chars)"),
  "expires-in": z.string().optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Issue a warning to a member")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The member to warn")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("reason")
      .setDescription("Reason for the warning")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("expires-in")
      .setDescription("Warning expiration (e.g., 7d, 30d, 90d)")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

function parseExpiration(input: string): Date | null {
  const match = /^(\d+)([dhm])$/i.exec(input.trim());
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const ms = amount * (multipliers[unit] || 0);
  return new Date(Date.now() + ms);
}

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ModerateMembers]))
  .use(
    rateLimitMiddleware({
      max: 10,
      window: 60000, // 10 warns per minute
      scope: "guild",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId, reason, "expires-in": expiresIn } = getValidatedOptions<
      z.infer<typeof optionsSchema>
    >(interaction);

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const user = await interaction.client.users.fetch(userId);
    const member = await guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.editReply({
        content: "❌ User is not a member of this server.",
      });
      return;
    }

    // Check role hierarchy
    const executor = await guild.members.fetch(interaction.user.id);
    if (member.roles.highest.position >= executor.roles.highest.position) {
      await interaction.editReply({
        content: `❌ You cannot warn **${user.tag}** due to role hierarchy.`,
      });
      return;
    }

    // Parse expiration
    let expiresAt: Date | null = null;
    if (expiresIn) {
      expiresAt = parseExpiration(expiresIn);
      if (!expiresAt) {
        await interaction.editReply({
          content: "❌ Invalid expiration format. Use: `7d`, `30d`, `90d`, etc.",
        });
        return;
      }
    }

    // Try to DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle("⚠️ Warning Issued")
        .setDescription(`You received a warning in **${guild.name}**`)
        .setColor(0xffaa00)
        .addFields({
          name: "Reason",
          value: reason,
        })
        .setTimestamp();

      if (expiresAt) {
        dmEmbed.addFields({
          name: "Expires",
          value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
        });
      }

      await user.send({ embeds: [dmEmbed] });
    } catch {
      // User has DMs disabled or blocked the bot
    }

    // Save warning to database and audit log
    try {
      await ensureUser(user);
      await db.insert(warnings).values({
        id: nanoid(),
        userId: user.id,
        guildId: guild.id,
        moderatorId: interaction.user.id,
        reason,
        expiresAt,
        isActive: true,
      });

      await createAuditLog({
        guildId: guild.id,
        moderatorId: interaction.user.id,
        action: "warn",
        targetId: user.id,
        reason,
        metadata: {
          expiresAt: expiresAt?.toISOString(),
        },
      });
    } catch (err) {
      console.error("Failed to save warning to database:", err);
    }

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Warning Issued")
      .setColor(0xffaa00)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "User", value: `${user.tag} (\`${user.id}\`)`, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true },
        { name: "Reason", value: reason }
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    if (expiresAt) {
      embed.addFields({
        name: "Expires",
        value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
