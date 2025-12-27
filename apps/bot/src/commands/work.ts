import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { getEconomy, addBalance, calculateWorkReward, formatCurrency } from "../utils/economy.js";
import { db } from "../db/index.js";
import { economy } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

/**
 * Work command - Work for currency with cooldown
 */

const WORK_RESPONSES = [
  "worked as a developer and debugged some code",
  "delivered pizzas around town",
  "streamed on Twitch",
  "walked dogs in the neighborhood",
  "worked as a cashier",
  "mowed lawns",
  "taught an online course",
  "worked at a coffee shop",
  "did some freelance work",
  "drove for a rideshare",
  "worked as a delivery driver",
  "did some graphic design",
];

const commandData = new SlashCommandBuilder()
  .setName("work")
  .setDescription("Work to earn currency");

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

    // Check if work is available (1 hour cooldown)
    if (eco.lastWork) {
      const now = Date.now();
      const lastWork = eco.lastWork.getTime();
      const cooldown = 60 * 60 * 1000; // 1 hour
      const timeLeft = cooldown - (now - lastWork);

      if (timeLeft > 0) {
        const minutes = Math.floor(timeLeft / (60 * 1000));
        const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

        const embed = new EmbedBuilder()
          .setTitle("⏰ Work Cooldown")
          .setDescription(`You're tired! Rest for **${minutes}m ${seconds}s** before working again.`)
          .setColor(0xff6b6b)
          .setFooter({ text: `Next work: ${new Date(lastWork + cooldown).toLocaleString()}` });

        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    // Calculate reward
    const reward = calculateWorkReward();

    // Add to balance
    await addBalance(user.id, guild.id, reward, "work");

    // Update last work timestamp
    await db
      .update(economy)
      .set({
        lastWork: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(economy.userId, user.id), eq(economy.guildId, guild.id)));

    const newBalance = eco.balance + reward;
    const job = WORK_RESPONSES[Math.floor(Math.random() * WORK_RESPONSES.length)];

    const embed = new EmbedBuilder()
      .setTitle("💼 Work Complete!")
      .setDescription(`You ${job} and earned ${formatCurrency(reward)}!`)
      .setColor(0x00ff00)
      .addFields({
        name: "💵 New Balance",
        value: formatCurrency(newBalance),
        inline: true,
      })
      .setFooter({ text: "You can work again in 1 hour" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
