import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  time as discordTime,
  TimestampStyles,
  MessageFlags,
} from "discord.js";
import { queues } from "../queue/index";

function parseWhen(input: string): number | null {
  const rel = /^(\d+)([smhd])$/i.exec(input.trim());
  if (rel) {
    const n = Number(rel[1]);
    const mult = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[
      rel[2].toLowerCase() as "s" | "m" | "h" | "d"
    ]!;
    return n * mult;
  }
  const abs = Date.parse(input);
  if (!Number.isNaN(abs)) {
    const delay = abs - Date.now();
    return delay > 0 ? delay : null;
  }
  return null;
}

export const data = new SlashCommandBuilder()
  .setName("remind")
  .setDescription("Schedule a reminder (Redis-backed; survives restarts).")
  .addStringOption((o) =>
    o.setName("when").setDescription("10m, 2h, 3d or ISO time").setRequired(true),
  )
  .addStringOption((o) =>
    o.setName("what").setDescription("What to remind you of").setRequired(true),
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const when = interaction.options.getString("when", true);
  const what = interaction.options.getString("what", true);

  const delay = parseWhen(when);
  if (delay === null || delay < 5_000 || delay > 30 * 24 * 3600_000) {
    await interaction.reply({
      content: "Invalid `when`. Use `10m`, `2h`, `3d`, or ISO time. Range: 5s–30d.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const dueAt = Date.now() + delay;

  // include the interaction webhook info so the worker can delete the ephemeral later
  await queues.reminders.add(
    "remind",
    {
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
    { delay, removeOnComplete: true, attempts: 1 },
  );

  const eta = new Date(dueAt);
  await interaction.editReply({
    content: `⏰ Scheduled **${what}** — ETA ${discordTime(
      eta,
      TimestampStyles.RelativeTime,
    )} (${discordTime(eta)})`,
  });
}
