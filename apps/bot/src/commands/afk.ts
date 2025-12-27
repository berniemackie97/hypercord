import { SlashCommandBuilder } from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, getValidatedOptions } from "../core/validation.js";
import { db } from "../db/index.js";
import { afkStatus } from "../db/schema.js";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { ensureUser } from "../db/utils.js";

const optionsSchema = z.object({
  reason: z.string().max(200).optional(),
});

const commandData = new SlashCommandBuilder()
  .setName("afk")
  .setDescription("Set your AFK status")
  .addStringOption((o) =>
    o.setName("reason").setDescription("Reason for being AFK").setMaxLength(200).setRequired(false)
  );

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(rateLimitMiddleware({ max: 5, window: 60000, scope: "user" }))
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { reason } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    await ensureUser(interaction.user);

    // Check if already AFK
    const existing = await db
      .select()
      .from(afkStatus)
      .where(and(eq(afkStatus.userId, interaction.user.id), eq(afkStatus.guildId, interaction.guild!.id)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(afkStatus)
        .where(and(eq(afkStatus.userId, interaction.user.id), eq(afkStatus.guildId, interaction.guild!.id)));

      await interaction.reply({
        content: "✅ Your AFK status has been removed!",
        ephemeral: true,
      });
      return;
    }

    // Set AFK
    await db.insert(afkStatus).values({
      id: nanoid(),
      userId: interaction.user.id,
      guildId: interaction.guild!.id,
      reason: reason || null,
    });

    await interaction.reply({
      content: `✅ You are now AFK${reason ? `: ${reason}` : ""}`,
      ephemeral: true,
    });
  })
  .build();
