import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";

/**
 * Ping command - Test bot responsiveness and latency
 *
 * Features:
 * - Shows roundtrip latency
 * - Shows WebSocket heartbeat ping
 * - Rate limited to prevent spam
 */
const commandData = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency and responsiveness")
  .setDMPermission(true);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 10000, // 5 uses per 10 seconds
      scope: "user",
    })
  )
  .setHandler(async (interaction) => {
    const sent = await interaction.reply({
      content: "🏓 Pinging...",
      fetchReply: true,
    });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsHeartbeat = interaction.client.ws.ping;

    const embed = new EmbedBuilder()
      .setTitle("🏓 Pong!")
      .setColor(roundtrip < 100 ? 0x00ff00 : roundtrip < 200 ? 0xffff00 : 0xff0000)
      .addFields(
        {
          name: "Roundtrip Latency",
          value: `\`${roundtrip}ms\``,
          inline: true,
        },
        {
          name: "WebSocket Heartbeat",
          value: `\`${wsHeartbeat}ms\``,
          inline: true,
        }
      )
      .setFooter({ text: `Shard ${interaction.guild?.shardId ?? 0}` })
      .setTimestamp();

    await interaction.editReply({
      content: null,
      embeds: [embed],
    });
  })
  .build();
