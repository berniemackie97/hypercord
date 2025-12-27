import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";
import { getLevel, calculateXPForLevel } from "../utils/leveling.js";
import { db } from "../db/index.js";
import { levels } from "../db/schema.js";
import { eq, gt, and } from "drizzle-orm";

const optionsSchema = z.object({
  user: schemas.snowflake.optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("View your or another user's rank and level")
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

    const levelRecord = await getLevel(userId, guild.id);

    // Calculate rank
    const higherRanks = await db
      .select()
      .from(levels)
      .where(and(eq(levels.guildId, guild.id), gt(levels.totalXp, levelRecord.totalXp)));

    const rank = higherRanks.length + 1;

    const xpNeeded = calculateXPForLevel(levelRecord.level);
    const progress = ((levelRecord.xp / xpNeeded) * 100).toFixed(1);

    // Create progress bar
    const barLength = 20;
    const filledLength = Math.round((levelRecord.xp / xpNeeded) * barLength);
    const progressBar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Rank`)
      .setColor(0x5865f2)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        {
          name: "🏆 Rank",
          value: `#${rank}`,
          inline: true,
        },
        {
          name: "⭐ Level",
          value: levelRecord.level.toString(),
          inline: true,
        },
        {
          name: "📊 Total XP",
          value: levelRecord.totalXp.toLocaleString(),
          inline: true,
        },
        {
          name: "📈 Progress",
          value: `\`${progressBar}\` ${progress}%\n${levelRecord.xp.toLocaleString()}/${xpNeeded.toLocaleString()} XP`,
          inline: false,
        },
        {
          name: "💬 Messages",
          value: levelRecord.messageCount.toLocaleString(),
          inline: true,
        }
      )
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
