import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import {
  loggingMiddleware,
  permissionMiddleware,
  guildOnlyMiddleware,
} from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, getValidatedOptions } from "../core/validation.js";
import { getGuildConfig, updateGuildConfig, resetGuildConfig } from "../core/guildConfig.js";

/**
 * Config command - Manage guild-specific bot configuration
 *
 * Features:
 * - View current configuration
 * - Set mod log channel
 * - Set welcome/leave channels
 * - Set auto-role
 * - Reset configuration
 */

const optionsSchema = z.object({
  action: z.enum(["view", "set-modlog", "set-welcome", "set-leave", "set-autorole", "reset"]),
  channel: z.string().optional(),
  role: z.string().optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Manage server bot configuration")
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View current server configuration")
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-modlog")
      .setDescription("Set the moderation log channel")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("The channel for mod logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-welcome")
      .setDescription("Set the welcome message channel")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("The channel for welcome messages")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-leave")
      .setDescription("Set the leave message channel")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("The channel for leave messages")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-autorole")
      .setDescription("Set the auto-role for new members")
      .addRoleOption((o) =>
        o
          .setName("role")
          .setDescription("The role to automatically assign")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("reset")
      .setDescription("Reset all server configuration to defaults")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ManageGuild]))
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 60000,
      scope: "guild",
    })
  )
  .setHandler(async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      const config = await getGuildConfig(guild.id);

      const embed = new EmbedBuilder()
        .setTitle(`⚙️ Server Configuration - ${guild.name}`)
        .setColor(0x5865f2)
        .addFields(
          {
            name: "Mod Log Channel",
            value: config.modLogChannel ? `<#${config.modLogChannel}>` : "Not set",
            inline: true,
          },
          {
            name: "Welcome Channel",
            value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : "Not set",
            inline: true,
          },
          {
            name: "Leave Channel",
            value: config.leaveChannel ? `<#${config.leaveChannel}>` : "Not set",
            inline: true,
          },
          {
            name: "Auto Role",
            value: config.autoRole ? `<@&${config.autoRole}>` : "Not set",
            inline: true,
          },
          {
            name: "Max Warnings",
            value: config.maxWarnings?.toString() || "3",
            inline: true,
          },
          {
            name: "Warning Timeout Duration",
            value: `${config.warnTimeoutDuration || 60} minutes`,
            inline: true,
          }
        )
        .setFooter({ text: "Use /config set-* commands to update" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === "reset") {
      const success = await resetGuildConfig(guild.id);

      if (success) {
        await interaction.editReply({
          content: "✅ Server configuration has been reset to defaults.",
        });
      } else {
        await interaction.editReply({
          content: "❌ Failed to reset server configuration.",
        });
      }
      return;
    }

    // Handle set-* commands
    const channel = interaction.options.getChannel("channel");
    const role = interaction.options.getRole("role");

    let updateKey: string | null = null;
    let updateValue: string | null = null;
    let successMessage = "";

    switch (subcommand) {
      case "set-modlog":
        updateKey = "modLogChannel";
        updateValue = channel?.id || null;
        successMessage = `✅ Mod log channel set to <#${channel?.id}>`;
        break;
      case "set-welcome":
        updateKey = "welcomeChannel";
        updateValue = channel?.id || null;
        successMessage = `✅ Welcome channel set to <#${channel?.id}>`;
        break;
      case "set-leave":
        updateKey = "leaveChannel";
        updateValue = channel?.id || null;
        successMessage = `✅ Leave channel set to <#${channel?.id}>`;
        break;
      case "set-autorole":
        updateKey = "autoRole";
        updateValue = role?.id || null;
        successMessage = `✅ Auto-role set to <@&${role?.id}>`;
        break;
    }

    if (updateKey && updateValue !== null) {
      const success = await updateGuildConfig(guild.id, {
        [updateKey]: updateValue,
      });

      if (success) {
        await interaction.editReply({ content: successMessage });
      } else {
        await interaction.editReply({
          content: "❌ Failed to update configuration.",
        });
      }
    }
  })
  .build();
