import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";

const commandData = new SlashCommandBuilder()
  .setName("ai-quota")
  .setDescription("Check your AI usage quota");

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(rateLimitMiddleware({ max: 10, window: 60000, scope: "user" }))
  .setHandler(async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const guildId = interaction.guild!.id;

    // Get user access grants
    const userAccess = await db.query.aiUserAccess.findFirst({
      where: (a, { eq, and }) => and(eq(a.userId, userId), eq(a.guildId, guildId)),
    });

    // Get current month's quota
    const month = new Date().toISOString().slice(0, 7);
    const quotas = await db.query.aiQuotas.findMany({
      where: (q, { eq, and }) => and(eq(q.userId, userId), eq(q.guildId, guildId), eq(q.month, month)),
    });

    const embed = new EmbedBuilder()
      .setTitle("🤖 Your AI Quota")
      .setColor(0x00ff00)
      .setDescription(`Usage for ${new Date().toLocaleString("default", { month: "long", year: "numeric" })}`)
      .setFooter({ text: `User ID: ${userId}` })
      .setTimestamp();

    // Show user access if granted
    if (userAccess) {
      const expired = userAccess.expiresAt && userAccess.expiresAt < new Date();
      embed.addFields({
        name: "🎫 Personal Access",
        value: expired
          ? `❌ Expired <t:${Math.floor(userAccess.expiresAt!.getTime() / 1000)}:R>`
          : `**Provider:** ${userAccess.provider}\n**Model:** ${userAccess.model}${userAccess.monthlyLimit ? `\n**Limit:** ${userAccess.monthlyLimit} messages/month` : "\n**Limit:** Unlimited"}${userAccess.expiresAt ? `\n**Expires:** <t:${Math.floor(userAccess.expiresAt.getTime() / 1000)}:R>` : "\n**Expires:** Never"}`,
        inline: false,
      });

      if (userAccess.monthlyLimit) {
        const progress = Math.min((userAccess.usedThisMonth / userAccess.monthlyLimit) * 100, 100);
        const bar = createProgressBar(progress);
        embed.addFields({
          name: "📊 Monthly Usage",
          value: `${bar}\n${userAccess.usedThisMonth} / ${userAccess.monthlyLimit} messages (${progress.toFixed(1)}%)`,
          inline: false,
        });
      }
    }

    // Show quota breakdown by provider
    if (quotas.length > 0) {
      for (const quota of quotas) {
        embed.addFields({
          name: `${getProviderEmoji(quota.provider)} ${quota.provider.toUpperCase()}`,
          value: `**Messages:** ${quota.messagesUsed}\n**Tokens:** ${quota.tokensUsed.toLocaleString()}\n**Cost:** $${quota.totalCost.toFixed(4)}`,
          inline: true,
        });
      }

      // Total cost
      const totalCost = quotas.reduce((sum, q) => sum + q.totalCost, 0);
      const totalMessages = quotas.reduce((sum, q) => sum + q.messagesUsed, 0);
      const totalTokens = quotas.reduce((sum, q) => sum + q.tokensUsed, 0);

      embed.addFields({
        name: "💰 Total This Month",
        value: `**Messages:** ${totalMessages}\n**Tokens:** ${totalTokens.toLocaleString()}\n**Cost:** $${totalCost.toFixed(4)}`,
        inline: false,
      });
    } else {
      embed.addFields({
        name: "📊 Usage",
        value: "No AI usage this month yet. Mention the bot to start chatting!",
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  })
  .build();

/**
 * Create progress bar
 */
function createProgressBar(percent: number, length: number = 10): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

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
