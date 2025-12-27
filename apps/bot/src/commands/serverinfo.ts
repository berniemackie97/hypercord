import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";

const commandData = new SlashCommandBuilder()
  .setName("serverinfo")
  .setDescription("Display information about the server");

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 60000,
      scope: "user",
    })
  )
  .setHandler(async (interaction) => {
    await interaction.deferReply();

    const guild = interaction.guild!;

    const owner = await guild.fetchOwner();
    const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL())
      .setColor(0x5865f2)
      .addFields(
        {
          name: "👑 Owner",
          value: owner.user.tag,
          inline: true,
        },
        {
          name: "📅 Created",
          value: `<t:${createdTimestamp}:R>`,
          inline: true,
        },
        {
          name: "👥 Members",
          value: guild.memberCount.toString(),
          inline: true,
        },
        {
          name: "💬 Channels",
          value: guild.channels.cache.size.toString(),
          inline: true,
        },
        {
          name: "🎭 Roles",
          value: guild.roles.cache.size.toString(),
          inline: true,
        },
        {
          name: "😀 Emojis",
          value: guild.emojis.cache.size.toString(),
          inline: true,
        },
        {
          name: "🚀 Boost Level",
          value: `Level ${guild.premiumTier}`,
          inline: true,
        },
        {
          name: "💎 Boosts",
          value: (guild.premiumSubscriptionCount || 0).toString(),
          inline: true,
        },
        {
          name: "🔒 Verification Level",
          value: guild.verificationLevel.toString(),
          inline: true,
        }
      )
      .setFooter({ text: `Server ID: ${guild.id}` })
      .setTimestamp();

    if (guild.description) {
      embed.setDescription(guild.description);
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
