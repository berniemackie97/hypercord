import {
  SlashCommandBuilder,
  time as discordTime,
  TimestampStyles,
} from "discord.js";
import { z } from "zod";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, getValidatedOptions } from "../core/validation.js";
import { queues } from "../queue/index.js";
import { db } from "../db/index.js";
import { reminders } from "../db/schema.js";
import { nanoid } from "nanoid";

/**
 * Remind command - Schedule reminders with Redis-backed persistence
 *
 * Features:
 * - Relative time (10m, 2h, 3d) or absolute ISO timestamps
 * - Survives bot restarts (Redis-backed)
 * - Rate limited per user
 * - Input validation with helpful error messages
 */

function parseWhen(input: string): number | null {
  // Try relative format: 10m, 2h, 3d
  const rel = /^(\d+)([smhd])$/i.exec(input.trim());
  if (rel) {
    const n = Number(rel[1]);
    const mult = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[
      rel[2].toLowerCase() as "s" | "m" | "h" | "d"
    ]!;
    return n * mult;
  }

  // Try absolute ISO timestamp
  const abs = Date.parse(input);
  if (!Number.isNaN(abs)) {
    const delay = abs - Date.now();
    return delay > 0 ? delay : null;
  }

  return null;
}

const optionsSchema = z.object({
  when: z.string().min(1, "Time cannot be empty"),
  what: z.string().min(1, "Reminder text cannot be empty").max(500, "Reminder text too long (max 500 chars)"),
});

const commandData = new SlashCommandBuilder()
  .setName("remind")
  .setDescription("Schedule a reminder (Redis-backed; survives restarts)")
  .addStringOption((o) =>
    o
      .setName("when")
      .setDescription("10m, 2h, 3d or ISO time")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o
      .setName("what")
      .setDescription("What to remind you of")
      .setRequired(true)
  )
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(
    rateLimitMiddleware({
      max: 5,
      window: 60000, // 5 reminders per minute
      scope: "user",
    })
  )
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { when, what } = getValidatedOptions<z.infer<typeof optionsSchema>>(interaction);

    const delay = parseWhen(when);

    // Validate delay range
    if (delay === null || delay < 5_000 || delay > 30 * 24 * 3600_000) {
      await interaction.reply({
        content:
          "❌ Invalid `when` parameter.\n\n" +
          "**Supported formats:**\n" +
          "• Relative: `10s`, `5m`, `2h`, `3d`\n" +
          "• Absolute: ISO timestamp\n\n" +
          "**Range:** 5 seconds to 30 days",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const dueAt = Date.now() + delay;
    const reminderId = nanoid();

    // Save reminder to database
    await db.insert(reminders).values({
      id: reminderId,
      userId: interaction.user.id,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      content: what,
      scheduledFor: new Date(dueAt),
      isCompleted: false,
    });

    // Schedule reminder in Redis queue
    await queues.reminders.add(
      "remind",
      {
        reminderId,
        guildId: interaction.guildId!,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        what,
        dueAt,
        original: {
          appId: interaction.applicationId,
          token: interaction.token,
          createdAt: Date.now(),
        },
      },
      {
        delay,
        removeOnComplete: true,
        attempts: 1,
      }
    );

    const eta = new Date(dueAt);
    await interaction.editReply({
      content:
        `⏰ **Reminder Scheduled**\n\n` +
        `**What:** ${what}\n` +
        `**When:** ${discordTime(eta, TimestampStyles.RelativeTime)} (${discordTime(eta)})\n` +
        `**Channel:** <#${interaction.channelId}>`,
    });
  })
  .build();
