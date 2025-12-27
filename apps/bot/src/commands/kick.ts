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

/**
 * Kick command - Remove a member from the server
 *
 * Features:
 * - Kick members with optional reason
 * - Permission checks and role hierarchy
 * - Rate limited
 * - Audit logging
 */

const optionsSchema = z.object({
  user: schemas.snowflake,
  reason: z.string().max(512, "Reason too long (max 512 chars)").optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a member from the server")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The member to kick")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("reason")
      .setDescription("Reason for the kick")
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.KickMembers]))
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 60000, // 5 kicks per minute
      scope: "guild",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId, reason } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member) {
      await interaction.editReply({
        content: "❌ User is not a member of this server.",
      });
      return;
    }

    // Check if member is kickable
    if (!member.kickable) {
      await interaction.editReply({
        content: `❌ Cannot kick **${member.user.tag}** (missing permissions or role hierarchy).`,
      });
      return;
    }

    // Check role hierarchy
    const executor = await guild.members.fetch(interaction.user.id);
    if (member.roles.highest.position >= executor.roles.highest.position) {
      await interaction.editReply({
        content: `❌ You cannot kick **${member.user.tag}** due to role hierarchy.`,
      });
      return;
    }

    // Try to DM the user before kicking
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle("👢 You have been kicked")
        .setDescription(`You were kicked from **${guild.name}**`)
        .setColor(0xffa500)
        .addFields({
          name: "Reason",
          value: reason || "No reason provided",
        })
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] });
    } catch {
      // User has DMs disabled or blocked the bot
    }

    // Execute the kick
    await member.kick(reason || `Kicked by ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setTitle("👢 Member Kicked")
      .setColor(0xffa500)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: "User", value: `${member.user.tag} (\`${member.user.id}\`)`, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true },
        { name: "Reason", value: reason || "No reason provided" }
      )
      .setFooter({ text: `User ID: ${member.user.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
