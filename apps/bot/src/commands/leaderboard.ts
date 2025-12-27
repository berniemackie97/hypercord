import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { db } from "../db/index.js";
import { economy, levels } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { formatCurrency } from "../utils/economy.js";

const commandData = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View server leaderboards")
  .addStringOption((o) =>
    o
      .setName("type")
      .setDescription("Leaderboard type")
      .setRequired(true)
      .addChoices(
        { name: "💰 Currency", value: "currency" },
        { name: "⭐ Levels", value: "levels" }
      )
  );

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
    const type = interaction.options.getString("type", true);

    if (type === "currency") {
      const top = await db
        .select()
        .from(economy)
        .where(eq(economy.guildId, guild.id))
        .orderBy(desc(economy.balance))
        .limit(10);

      if (top.length === 0) {
        await interaction.editReply({
          content: "No economy data found for this server yet!",
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`💰 ${guild.name} - Currency Leaderboard`)
        .setColor(0xffd700)
        .setTimestamp();

      let description = "";
      for (let i = 0; i < top.length; i++) {
        const user = await interaction.client.users.fetch(top[i].userId).catch(() => null);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
        description += `${medal} ${user?.tag || "Unknown"} - ${formatCurrency(top[i].balance)}\n`;
      }

      embed.setDescription(description);
      await interaction.editReply({ embeds: [embed] });
    } else {
      const top = await db
        .select()
        .from(levels)
        .where(eq(levels.guildId, guild.id))
        .orderBy(desc(levels.totalXp))
        .limit(10);

      if (top.length === 0) {
        await interaction.editReply({
          content: "No leveling data found for this server yet!",
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`⭐ ${guild.name} - Level Leaderboard`)
        .setColor(0x5865f2)
        .setTimestamp();

      let description = "";
      for (let i = 0; i < top.length; i++) {
        const user = await interaction.client.users.fetch(top[i].userId).catch(() => null);
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
        description += `${medal} ${user?.tag || "Unknown"} - Level ${top[i].level} (${top[i].totalXp.toLocaleString()} XP)\n`;
      }

      embed.setDescription(description);
      await interaction.editReply({ embeds: [embed] });
    }
  })
  .build();
