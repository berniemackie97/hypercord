import { SlashCommandBuilder, EmbedBuilder, time, TimestampStyles } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";

/**
 * Userinfo command - Display detailed information about a user
 *
 * Features:
 * - Shows user account info, roles, permissions
 * - Join/creation dates
 * - Avatar and banner
 * - Works in DMs (shows limited info)
 */

const optionsSchema = z.object({
  user: schemas.snowflake.optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Get detailed information about a user")
  .addUserOption((o) =>
    o
      .setName("user")
      .setDescription("The user to get info about (defaults to you)")
      .setRequired(false)
  )
  .setDMPermission(true);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(
    rateLimitMiddleware({
      max: 10,
      window: 60000, // 10 uses per minute
      scope: "user",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await interaction.deferReply();

    const targetUser = userId
      ? await interaction.client.users.fetch(userId)
      : interaction.user;

    const embed = new EmbedBuilder()
      .setTitle(`User Information: ${targetUser.tag}`)
      .setColor(0x5865f2)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Username", value: targetUser.username, inline: true },
        { name: "Display Name", value: targetUser.displayName, inline: true },
        { name: "ID", value: `\`${targetUser.id}\``, inline: true },
        {
          name: "Account Created",
          value: time(targetUser.createdAt, TimestampStyles.RelativeTime),
          inline: true,
        },
        {
          name: "Bot Account",
          value: targetUser.bot ? "✅ Yes" : "❌ No",
          inline: true,
        }
      )
      .setFooter({ text: `User ID: ${targetUser.id}` })
      .setTimestamp();

    // Add banner if available
    const fetchedUser = await targetUser.fetch();
    if (fetchedUser.banner) {
      embed.setImage(fetchedUser.bannerURL({ size: 512 })!);
    }

    // Add guild-specific info if in a guild
    if (interaction.guild) {
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (member) {
        const roles = member.roles.cache
          .filter((r) => r.id !== interaction.guild!.id) // Exclude @everyone
          .sort((a, b) => b.position - a.position)
          .map((r) => `<@&${r.id}>`)
          .slice(0, 20);

        embed.addFields(
          {
            name: "Joined Server",
            value: member.joinedAt
              ? time(member.joinedAt, TimestampStyles.RelativeTime)
              : "Unknown",
            inline: true,
          },
          {
            name: "Nickname",
            value: member.nickname || "None",
            inline: true,
          },
          {
            name: "Highest Role",
            value: `<@&${member.roles.highest.id}>`,
            inline: true,
          },
          {
            name: `Roles [${member.roles.cache.size - 1}]`,
            value: roles.length > 0 ? roles.join(", ") : "None",
          }
        );

        // Set color to highest role color
        if (member.roles.highest.color !== 0) {
          embed.setColor(member.roles.highest.color);
        }
      } else {
        embed.addFields({
          name: "Server Member",
          value: "❌ Not a member of this server",
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
