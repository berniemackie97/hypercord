import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";

const RESPONSES = [
  "It is certain.",
  "It is decidedly so.",
  "Without a doubt.",
  "Yes definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Outlook good.",
  "Yes.",
  "Signs point to yes.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Concentrate and ask again.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful.",
];

const commandData = new SlashCommandBuilder()
  .setName("8ball")
  .setDescription("Ask the magic 8-ball a question")
  .addStringOption((o) =>
    o.setName("question").setDescription("Your question").setRequired(true)
  );

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(
    rateLimitMiddleware({
      max: 10,
      window: 60000,
      scope: "user",
    })
  )
  .setHandler(async (interaction) => {
    const question = interaction.options.getString("question", true);
    const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];

    const embed = new EmbedBuilder()
      .setTitle("🎱 Magic 8-Ball")
      .addFields(
        { name: "Question", value: question, inline: false },
        { name: "Answer", value: response, inline: false }
      )
      .setColor(0x5865f2)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  })
  .build();
