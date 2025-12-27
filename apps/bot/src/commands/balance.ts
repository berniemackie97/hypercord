import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { getEconomy, formatCurrency } from "../utils/economy.js";

/**
 * Balance command - View user's economy balance
 */

const optionsSchema = z.object({
  user: schemas.snowflake.optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("View your or another user's balance")
  .addUserOption((o) =>
    o.setName("user").setDescription("The user to check (defaults to you)").setRequired(false)
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
    const { user: targetUserId } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await interaction.deferReply();

    const guild = interaction.guild!;
    const userId = targetUserId || interaction.user.id;
    const user = await interaction.client.users.fetch(userId);

    const eco = await getEconomy(userId, guild.id);

    const totalWealth = eco.balance + eco.bank;
    const netWorth = eco.totalEarned - eco.totalSpent;

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Balance`)
      .setColor(0xffd700)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        {
          name: "💵 Wallet",
          value: formatCurrency(eco.balance),
          inline: true,
        },
        {
          name: "🏦 Bank",
          value: formatCurrency(eco.bank),
          inline: true,
        },
        {
          name: "💎 Total Wealth",
          value: formatCurrency(totalWealth),
          inline: true,
        },
        {
          name: "📊 Statistics",
          value: `**Earned:** ${formatCurrency(eco.totalEarned)}\n**Spent:** ${formatCurrency(eco.totalSpent)}\n**Net:** ${formatCurrency(netWorth)}`,
          inline: false,
        }
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
