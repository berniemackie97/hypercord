import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, permissionMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, getValidatedOptions } from "../core/validation.js";
import { db } from "../db/index.js";
import { giveaways } from "../db/schema.js";
import { nanoid } from "nanoid";
import { parseDuration } from "../utils/dateParser.js";

const optionsSchema = z.object({
  duration: z.string(),
  winners: z.number().min(1).max(20).optional(),
  prize: z.string(),
});

const commandData = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Start a giveaway")
  .addStringOption((o) =>
    o.setName("duration").setDescription("Duration (e.g., 1h, 30m, 1d)").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("prize").setDescription("Prize for the giveaway").setRequired(true)
  )
  .addIntegerOption((o) =>
    o.setName("winners").setDescription("Number of winners (default: 1)").setMinValue(1).setMaxValue(20).setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ManageGuild]))
  .use(rateLimitMiddleware({ max: 3, window: 60000, scope: "guild" }))
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { duration: durationStr, winners: winnersCount, prize } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await interaction.deferReply({ ephemeral: true });

    const duration = parseDuration(durationStr);
    if (!duration) {
      await interaction.editReply({ content: "❌ Invalid duration format! Use formats like: 1h, 30m, 2d" });
      return;
    }

    const endsAt = new Date(Date.now() + duration);
    const winners = winnersCount || 1;

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${prize}`)
      .setDescription(`React with 🎉 to enter!\n\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`)
      .setColor(0xff69b4)
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp(endsAt);

    const message = await interaction.channel!.send({ embeds: [embed] });
    await message.react("🎉");

    // Save to database
    await db.insert(giveaways).values({
      id: nanoid(),
      guildId: interaction.guild!.id,
      channelId: interaction.channel!.id,
      messageId: message.id,
      hostId: interaction.user.id,
      prize,
      winnersCount: winners,
      endsAt,
      ended: false,
    });

    await interaction.editReply({ content: `✅ Giveaway created! [Jump to message](${message.url})` });

    // Schedule end (simple timeout for now, should use queue in production)
    setTimeout(async () => {
      try {
        await endGiveaway(message.id, interaction.guild!.id);
      } catch (err) {
        console.error("Failed to end giveaway:", err);
      }
    }, duration);
  })
  .build();

async function endGiveaway(messageId: string, guildId: string) {
  const giveaway = await db.query.giveaways.findFirst({
    where: (g, { eq, and }) => and(eq(g.messageId, messageId), eq(g.guildId, guildId), eq(g.ended, false)),
  });

  if (!giveaway) return;

  try {
    const channel = await (global as any).client.channels.fetch(giveaway.channelId);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages.fetch(messageId);
    const reaction = message.reactions.cache.get("🎉");
    if (!reaction) return;

    const users = await reaction.users.fetch();
    const validUsers = users.filter((u) => !u.bot);

    if (validUsers.size === 0) {
      await channel.send({ content: `🎉 Giveaway ended! No valid entries for **${giveaway.prize}**` });
      return;
    }

    const winnerIds: string[] = [];
    const winnerUsers = validUsers.random(Math.min(giveaway.winnersCount, validUsers.size));
    const winners = Array.isArray(winnerUsers) ? winnerUsers : [winnerUsers];

    winners.forEach((w) => winnerIds.push(w.id));

    const embed = new EmbedBuilder()
      .setTitle(`🎉 Giveaway Ended!`)
      .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winners.map((w) => w.toString()).join(", ")}`)
      .setColor(0x00ff00)
      .setFooter({ text: `Hosted by ${giveaway.hostId}` })
      .setTimestamp();

    await channel.send({ content: winners.map((w) => w.toString()).join(" "), embeds: [embed] });

    await db
      .update(giveaways)
      .set({ ended: true, winnerIds })
      .where((g) => g.id === giveaway.id);
  } catch (err) {
    console.error("Error ending giveaway:", err);
  }
}
