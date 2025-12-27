import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, permissionMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";
import { aiChannelConfig, guilds } from "../db/schema.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";

const commandData = new SlashCommandBuilder()
  .setName("ai-config")
  .setDescription("Configure AI assistant settings")
  .addSubcommand((sub) =>
    sub
      .setName("set-channel")
      .setDescription("Configure AI for a specific channel")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Channel to configure").addChannelTypes(ChannelType.GuildText).setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("provider")
          .setDescription("AI provider")
          .setRequired(true)
          .addChoices(
            { name: "Gemini (FREE)", value: "gemini" },
            { name: "OpenAI GPT", value: "openai" },
            { name: "Anthropic Claude", value: "anthropic" },
            { name: "Grok", value: "grok" }
          )
      )
      .addStringOption((o) =>
        o
          .setName("model")
          .setDescription("AI model")
          .setRequired(true)
          .addChoices(
            // Gemini
            { name: "Gemini 1.5 Flash (FREE)", value: "gemini-1.5-flash" },
            { name: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
            // OpenAI
            { name: "GPT-4o", value: "gpt-4o" },
            { name: "GPT-4o Mini (Cheapest)", value: "gpt-4o-mini" },
            { name: "GPT-4 Turbo", value: "gpt-4-turbo" },
            // Anthropic
            { name: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
            { name: "Claude 3.5 Haiku (Fast)", value: "claude-3-5-haiku-20241022" }
          )
      )
      .addStringOption((o) => o.setName("system-prompt").setDescription("Custom system prompt (optional)").setRequired(false))
      .addRoleOption((o) => o.setName("required-role").setDescription("Required role to use AI (optional)").setRequired(false))
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove-channel")
      .setDescription("Remove AI configuration from a channel")
      .addChannelOption((o) =>
        o.setName("channel").setDescription("Channel to remove config from").addChannelTypes(ChannelType.GuildText).setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-default")
      .setDescription("Set guild-wide default AI provider")
      .addStringOption((o) =>
        o
          .setName("provider")
          .setDescription("Default AI provider")
          .setRequired(true)
          .addChoices(
            { name: "Gemini (FREE)", value: "gemini" },
            { name: "OpenAI GPT", value: "openai" },
            { name: "Anthropic Claude", value: "anthropic" },
            { name: "Grok", value: "grok" },
            { name: "Disabled", value: "disabled" }
          )
      )
      .addStringOption((o) =>
        o
          .setName("model")
          .setDescription("Default AI model")
          .setRequired(false)
          .addChoices(
            { name: "Gemini 1.5 Flash (FREE)", value: "gemini-1.5-flash" },
            { name: "GPT-4o Mini (Cheapest)", value: "gpt-4o-mini" },
            { name: "Claude 3.5 Haiku (Fast)", value: "claude-3-5-haiku-20241022" }
          )
      )
  )
  .addSubcommand((sub) => sub.setName("list").setDescription("List all AI channel configurations"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ManageGuild]))
  .use(rateLimitMiddleware({ max: 10, window: 60000, scope: "user" }))
  .setHandler(async (interaction) => {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;

    if (subcommand === "set-channel") {
      const channel = interaction.options.getChannel("channel", true);
      const provider = interaction.options.getString("provider", true);
      const model = interaction.options.getString("model", true);
      const systemPrompt = interaction.options.getString("system-prompt");
      const requiredRole = interaction.options.getRole("required-role");

      // Check if config already exists
      const existing = await db.query.aiChannelConfig.findFirst({
        where: (c, { eq, and }) => and(eq(c.guildId, guild.id), eq(c.channelId, channel.id)),
      });

      if (existing) {
        // Update existing
        await db
          .update(aiChannelConfig)
          .set({
            provider: provider as any,
            model,
            systemPrompt: systemPrompt || null,
            requiredRole: requiredRole?.id || null,
            enabled: true,
            updatedAt: new Date(),
          })
          .where(eq(aiChannelConfig.id, existing.id));

        await interaction.editReply({
          content: `✅ Updated AI config for ${channel}!\n**Provider:** ${provider}\n**Model:** ${model}${requiredRole ? `\n**Required Role:** ${requiredRole}` : ""}`,
        });
      } else {
        // Create new
        await db.insert(aiChannelConfig).values({
          id: nanoid(),
          guildId: guild.id,
          channelId: channel.id,
          provider: provider as any,
          model,
          systemPrompt: systemPrompt || null,
          requiredRole: requiredRole?.id || null,
          enabled: true,
        });

        await interaction.editReply({
          content: `✅ Configured AI for ${channel}!\n**Provider:** ${provider}\n**Model:** ${model}${requiredRole ? `\n**Required Role:** ${requiredRole}` : ""}`,
        });
      }
    } else if (subcommand === "remove-channel") {
      const channel = interaction.options.getChannel("channel", true);

      await db.delete(aiChannelConfig).where(and(eq(aiChannelConfig.guildId, guild.id), eq(aiChannelConfig.channelId, channel.id)));

      await interaction.editReply({
        content: `✅ Removed AI configuration from ${channel}. It will now use the guild default.`,
      });
    } else if (subcommand === "set-default") {
      const provider = interaction.options.getString("provider", true);
      const model = interaction.options.getString("model") || getDefaultModel(provider);

      await db
        .update(guilds)
        .set({
          defaultAiProvider: provider as any,
          defaultAiModel: model,
          aiEnabled: provider !== "disabled",
          updatedAt: new Date(),
        })
        .where(eq(guilds.id, guild.id));

      if (provider === "disabled") {
        await interaction.editReply({
          content: "✅ AI assistant disabled guild-wide. You can still configure specific channels.",
        });
      } else {
        await interaction.editReply({
          content: `✅ Set guild default AI!\n**Provider:** ${provider}\n**Model:** ${model}\n\nMention the bot in any channel to use AI, or configure specific channels with \`/ai-config set-channel\`.`,
        });
      }
    } else if (subcommand === "list") {
      const configs = await db.query.aiChannelConfig.findMany({
        where: (c, { eq }) => eq(c.guildId, guild.id),
      });

      const guildData = await db.query.guilds.findFirst({
        where: (g, { eq }) => eq(g.id, guild.id),
      });

      const embed = new EmbedBuilder()
        .setTitle("🤖 AI Configuration")
        .setColor(0x00ff00)
        .setTimestamp();

      // Guild default
      if (guildData) {
        embed.addFields({
          name: "Guild Default",
          value: guildData.aiEnabled
            ? `**Provider:** ${guildData.defaultAiProvider}\n**Model:** ${guildData.defaultAiModel}`
            : "❌ Disabled",
          inline: false,
        });
      }

      // Channel configs
      if (configs.length > 0) {
        for (const config of configs.slice(0, 10)) {
          // Limit to 10
          const channel = await guild.channels.fetch(config.channelId).catch(() => null);
          if (channel) {
            embed.addFields({
              name: `#${channel.name}`,
              value: `**Provider:** ${config.provider}\n**Model:** ${config.model}${config.requiredRole ? `\n**Required Role:** <@&${config.requiredRole}>` : ""}`,
              inline: true,
            });
          }
        }

        if (configs.length > 10) {
          embed.setFooter({ text: `Showing 10 of ${configs.length} channel configs` });
        }
      } else {
        embed.addFields({
          name: "Channel Configs",
          value: "No channel-specific configs. Using guild default.",
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    }
  })
  .build();

/**
 * Get default model for provider
 */
function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    gemini: "gemini-1.5-flash",
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-20241022",
    grok: "grok-2",
    disabled: "",
  };
  return defaults[provider] || "gemini-1.5-flash";
}
