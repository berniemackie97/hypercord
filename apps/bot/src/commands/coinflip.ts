import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { getEconomy, addBalance, removeBalance, formatCurrency } from "../utils/economy.js";

const optionsSchema = z.object({
  bet: schemas.nonNegativeInt.min(1, "Bet must be at least 1").optional(),
  choice: z.enum(["heads", "tails"]).optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Flip a coin (optionally gamble currency)")
  .addIntegerOption((o) =>
    o.setName("bet").setDescription("Amount to bet (optional)").setMinValue(1).setRequired(false)
  )
  .addStringOption((o) =>
    o
      .setName("choice")
      .setDescription("Your choice (required if betting)")
      .setRequired(false)
      .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" })
  );

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(
    rateLimitMiddleware({
      max: 10,
      window: 60000,
      scope: "user",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { bet, choice } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await interaction.deferReply();

    const guild = interaction.guild!;
    const user = interaction.user;

    const result = Math.random() < 0.5 ? "heads" : "tails";
    const resultEmoji = result === "heads" ? "🪙 Heads" : "🪙 Tails";

    // Simple coinflip (no gambling)
    if (!bet) {
      const embed = new EmbedBuilder()
        .setTitle("🪙 Coinflip")
        .setDescription(`The coin landed on **${resultEmoji}**!`)
        .setColor(0x5865f2)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Gambling mode
    if (!choice) {
      await interaction.editReply({
        content: "❌ You must choose heads or tails when betting!",
      });
      return;
    }

    const eco = await getEconomy(user.id, guild.id);

    if (eco.balance < bet) {
      await interaction.editReply({
        content: `❌ You don't have enough currency! You need ${formatCurrency(bet)}.`,
      });
      return;
    }

    const won = result === choice;

    if (won) {
      await addBalance(user.id, guild.id, bet, "coinflip_win");

      const embed = new EmbedBuilder()
        .setTitle("🎉 You Won!")
        .setDescription(`The coin landed on **${resultEmoji}**!\nYou won ${formatCurrency(bet)}!`)
        .setColor(0x00ff00)
        .addFields({
          name: "💵 New Balance",
          value: formatCurrency(eco.balance + bet),
          inline: true,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await removeBalance(user.id, guild.id, bet, "coinflip_loss");

      const embed = new EmbedBuilder()
        .setTitle("😢 You Lost!")
        .setDescription(`The coin landed on **${resultEmoji}**!\nYou lost ${formatCurrency(bet)}.`)
        .setColor(0xff0000)
        .addFields({
          name: "💵 New Balance",
          value: formatCurrency(eco.balance - bet),
          inline: true,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  })
  .build();
