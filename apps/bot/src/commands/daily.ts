import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { getEconomy, addBalance, calculateDailyReward, formatCurrency } from "../utils/economy.js";
import { db } from "../db/index.js";
import { economy } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

/**
 * Daily command - Claim daily currency reward
 */

const commandData = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Claim your daily reward");

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
    const user = interaction.user;

    const eco = await getEconomy(user.id, guild.id);

    // Check if daily is available
    if (eco.lastDaily) {
      const now = Date.now();
      const lastDaily = eco.lastDaily.getTime();
      const cooldown = 24 * 60 * 60 * 1000; // 24 hours
      const timeLeft = cooldown - (now - lastDaily);

      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

        const embed = new EmbedBuilder()
          .setTitle("⏰ Daily Cooldown")
          .setDescription(`You can claim your daily reward in **${hours}h ${minutes}m**`)
          .setColor(0xff6b6b)
          .setFooter({ text: `Next claim: ${new Date(lastDaily + cooldown).toLocaleString()}` });

        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    // Calculate reward
    const reward = calculateDailyReward();

    // Add to balance
    await addBalance(user.id, guild.id, reward, "daily");

    // Update last daily timestamp
    await db
      .update(economy)
      .set({
        lastDaily: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(economy.userId, user.id), eq(economy.guildId, guild.id)));

    const newBalance = eco.balance + reward;

    const embed = new EmbedBuilder()
      .setTitle("🎁 Daily Reward Claimed!")
      .setDescription(`You received ${formatCurrency(reward)}!`)
      .setColor(0x00ff00)
      .addFields({
        name: "💵 New Balance",
        value: formatCurrency(newBalance),
        inline: true,
      })
      .setFooter({ text: "Come back tomorrow for another reward!" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
