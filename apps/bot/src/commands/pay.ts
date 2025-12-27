import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { transferBalance, formatCurrency } from "../utils/economy.js";

const optionsSchema = z.object({
  user: schemas.snowflake,
  amount: schemas.nonNegativeInt.min(1, "Amount must be at least 1"),
});

const commandData = new SlashCommandBuilder()
  .setName("pay")
  .setDescription("Transfer currency to another user")
  .addUserOption((o) =>
    o.setName("user").setDescription("The user to pay").setRequired(true)
  )
  .addIntegerOption((o) =>
    o.setName("amount").setDescription("Amount to pay").setMinValue(1).setRequired(true)
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
    const { user: targetUserId, amount } = getValidatedOptions<z.infer<typeof optionsSchema>>(
      interaction
    );

    await interaction.deferReply();

    const guild = interaction.guild!;
    const fromUser = interaction.user;
    const toUser = await interaction.client.users.fetch(targetUserId);

    if (toUser.bot) {
      await interaction.editReply({
        content: "❌ You cannot pay bots!",
      });
      return;
    }

    if (fromUser.id === toUser.id) {
      await interaction.editReply({
        content: "❌ You cannot pay yourself!",
      });
      return;
    }

    const success = await transferBalance(fromUser.id, toUser.id, guild.id, amount);

    if (!success) {
      await interaction.editReply({
        content: `❌ You don't have enough currency! You need ${formatCurrency(amount)}.`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("💸 Payment Successful")
      .setDescription(`${fromUser} paid ${formatCurrency(amount)} to ${toUser}`)
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
