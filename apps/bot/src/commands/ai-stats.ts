import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, permissionMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";
import { aiUsageLog, aiQuotas } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

const commandData = new SlashCommandBuilder()
  .setName("ai-stats")
  .setDescription("View AI usage statistics for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ManageGuild]))
  .use(rateLimitMiddleware({ max: 10, window: 60000, scope: "user" }))
  .setHandler(async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild!.id;
    const month = new Date().toISOString().slice(0, 7);

    // Get this month's usage logs
    const usageLogs = await db
      .select()
      .from(aiUsageLog)
      .where(and(eq(aiUsageLog.guildId, guildId), sql`strftime('%Y-%m', ${aiUsageLog.createdAt}) = ${month}`));

    // Get quota data
    const quotaData = await db.select().from(aiQuotas).where(and(eq(aiQuotas.guildId, guildId), eq(aiQuotas.month, month)));

    const embed = new EmbedBuilder()
      .setTitle("📊 AI Statistics")
      .setDescription(`Server-wide usage for ${new Date().toLocaleString("default", { month: "long", year: "numeric" })}`)
      .setColor(0x3498db)
      .setTimestamp();

    if (usageLogs.length === 0) {
      embed.addFields({
        name: "No Usage",
        value: "No AI usage this month yet.",
        inline: false,
      });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Overall stats
    const totalMessages = usageLogs.length;
    const successfulMessages = usageLogs.filter((l) => l.success).length;
    const totalCost = quotaData.reduce((sum, q) => sum + q.totalCost, 0);
    const totalTokens = quotaData.reduce((sum, q) => sum + q.tokensUsed, 0);
    const avgResponseTime = usageLogs.reduce((sum, l) => sum + l.responseTime, 0) / usageLogs.length;

    embed.addFields({
      name: "📈 Overview",
      value: `**Total Messages:** ${totalMessages}\n**Successful:** ${successfulMessages} (${((successfulMessages / totalMessages) * 100).toFixed(1)}%)\n**Total Cost:** $${totalCost.toFixed(4)}\n**Total Tokens:** ${totalTokens.toLocaleString()}\n**Avg Response Time:** ${Math.round(avgResponseTime)}ms`,
      inline: false,
    });

    // By provider
    const byProvider: Record<string, { count: number; cost: number; tokens: number }> = {};
    for (const log of usageLogs) {
      if (!byProvider[log.provider]) {
        byProvider[log.provider] = { count: 0, cost: 0, tokens: 0 };
      }
      byProvider[log.provider].count++;
      byProvider[log.provider].cost += log.estimatedCost;
      byProvider[log.provider].tokens += log.totalTokens;
    }

    for (const [provider, stats] of Object.entries(byProvider)) {
      embed.addFields({
        name: `${getProviderEmoji(provider)} ${provider.toUpperCase()}`,
        value: `**Messages:** ${stats.count}\n**Cost:** $${stats.cost.toFixed(4)}\n**Tokens:** ${stats.tokens.toLocaleString()}`,
        inline: true,
      });
    }

    // Top users
    const userUsage: Record<string, number> = {};
    for (const log of usageLogs) {
      userUsage[log.userId] = (userUsage[log.userId] || 0) + 1;
    }

    const topUsers = Object.entries(userUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topUsers.length > 0) {
      const topUsersText = await Promise.all(
        topUsers.map(async ([userId, count], index) => {
          const user = await interaction.client.users.fetch(userId).catch(() => null);
          return `${index + 1}. ${user?.tag || "Unknown"}: ${count} messages`;
        })
      );

      embed.addFields({
        name: "👥 Top Users",
        value: topUsersText.join("\n"),
        inline: false,
      });
    }

    // Most active channels
    const channelUsage: Record<string, number> = {};
    for (const log of usageLogs) {
      channelUsage[log.channelId] = (channelUsage[log.channelId] || 0) + 1;
    }

    const topChannels = Object.entries(channelUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topChannels.length > 0) {
      const topChannelsText = await Promise.all(
        topChannels.map(async ([channelId, count], index) => {
          const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
          return `${index + 1}. ${channel ? `#${channel.name}` : "Unknown"}: ${count} messages`;
        })
      );

      embed.addFields({
        name: "💬 Active Channels",
        value: topChannelsText.join("\n"),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();

/**
 * Get emoji for provider
 */
function getProviderEmoji(provider: string): string {
  const emojis: Record<string, string> = {
    gemini: "✨",
    openai: "🤖",
    anthropic: "🧠",
    grok: "⚡",
  };
  return emojis[provider] || "🤖";
}
