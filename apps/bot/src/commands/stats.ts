import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";
import { dailyStats, commandLogs, guilds, users } from "../db/schema.js";
import { desc, eq, count } from "drizzle-orm";

/**
 * Stats command - View bot statistics
 *
 * Features:
 * - Overall bot statistics (guilds, users, commands)
 * - Recent daily statistics
 * - Success rate
 * - Public command (no special permissions needed)
 */

const commandData = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("View bot statistics and performance metrics");

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 60000, // 5 requests per minute
      scope: "user",
    })
  )
  .setHandler(async (interaction) => {
    await interaction.deferReply();

    // Fetch overall statistics
    const [totalGuilds, totalUsers, totalCommands, recentStats] = await Promise.all([
      db.select({ count: count() }).from(guilds).where(eq(guilds.isActive, true)),
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(commandLogs),
      db.select().from(dailyStats).orderBy(desc(dailyStats.date)).limit(7),
    ]);

    // Calculate command success rate
    const [successfulCommands, failedCommands] = await Promise.all([
      db.select({ count: count() }).from(commandLogs).where(eq(commandLogs.success, true)),
      db.select({ count: count() }).from(commandLogs).where(eq(commandLogs.success, false)),
    ]);

    const totalCommandsCount = totalCommands[0]?.count || 0;
    const successCount = successfulCommands[0]?.count || 0;
    const failCount = failedCommands[0]?.count || 0;
    const successRate =
      totalCommandsCount > 0 ? ((successCount / totalCommandsCount) * 100).toFixed(2) : "0.00";

    const embed = new EmbedBuilder()
      .setTitle("📊 Bot Statistics")
      .setColor(0x5865f2)
      .setThumbnail(interaction.client.user?.displayAvatarURL() || null)
      .addFields(
        {
          name: "🌐 Servers",
          value: `${totalGuilds[0]?.count || 0}`,
          inline: true,
        },
        {
          name: "👥 Users",
          value: `${totalUsers[0]?.count || 0}`,
          inline: true,
        },
        {
          name: "⚡ Commands",
          value: `${totalCommandsCount}`,
          inline: true,
        },
        {
          name: "✅ Success Rate",
          value: `${successRate}%`,
          inline: true,
        },
        {
          name: "❌ Failed",
          value: `${failCount}`,
          inline: true,
        },
        {
          name: "🆙 Uptime",
          value: formatUptime(interaction.client.uptime || 0),
          inline: true,
        }
      )
      .setFooter({ text: `Shard ${interaction.guild?.shardId || 0}` })
      .setTimestamp();

    // Add recent daily stats if available
    if (recentStats.length > 0) {
      let statsText = "```\n";
      statsText += "Date       | Cmds | Active\n";
      statsText += "-----------|------|-------\n";

      for (const stat of recentStats.slice(0, 5)) {
        const date = new Date(stat.date).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
        });
        statsText += `${date}     | ${String(stat.commandsExecuted).padStart(4)} | ${String(stat.guildsActive).padStart(5)}\n`;
      }

      statsText += "```";

      embed.addFields({
        name: "📈 Recent Activity (Last 5 Days)",
        value: statsText,
        inline: false,
      });
    }

    // Add memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

    embed.addFields({
      name: "💾 Memory Usage",
      value: `${memoryMB} MB`,
      inline: true,
    });

    // Add ping
    const ping = interaction.client.ws.ping;
    embed.addFields({
      name: "🏓 WebSocket Ping",
      value: `${ping}ms`,
      inline: true,
    });

    await interaction.editReply({ embeds: [embed] });
  })
  .build();

/**
 * Format uptime to human readable string
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
