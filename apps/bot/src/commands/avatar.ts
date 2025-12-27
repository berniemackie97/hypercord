import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas, getValidatedOptions } from "../core/validation.js";

const optionsSchema = z.object({
  user: schemas.snowflake.optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("avatar")
  .setDescription("Display a user's avatar")
  .addUserOption((o) =>
    o.setName("user").setDescription("The user (defaults to you)").setRequired(false)
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
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user: userId } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    const targetUser = userId
      ? await interaction.client.users.fetch(userId)
      : interaction.user;

    const avatarURL = targetUser.displayAvatarURL({ size: 2048 });

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Avatar`)
      .setImage(avatarURL)
      .setColor(0x5865f2)
      .setDescription(`[Download](${avatarURL})`)
      .setFooter({ text: `User ID: ${targetUser.id}` });

    await interaction.reply({ embeds: [embed] });
  })
  .build();
