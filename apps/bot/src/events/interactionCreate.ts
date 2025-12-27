import { Events, MessageFlags } from "discord.js";
import { commands } from "../core/client.js";
import { log } from "../core/logger.js";
import { db } from "../db/index.js";
import { commandLogs } from "../db/schema.js";
import { ensureUser, ensureGuildMember } from "../db/utils.js";
import { nanoid } from "nanoid";

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: any) {
  if (!interaction.isChatInputCommand()) return;

  const cmd = commands.get(interaction.commandName);
  if (!cmd || typeof cmd.execute !== "function") return;

  // Track user and guild member (async, don't block)
  ensureUser(interaction.user).catch(() => {});
  if (interaction.member && interaction.guild) {
    ensureGuildMember(interaction.member).catch(() => {});
  }

  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    // Strong rule: every command must ack in <3s. Most of your commands already defer.
    await cmd.execute(interaction);
  } catch (err: any) {
    success = false;
    errorMessage = err?.message || "Unknown error";

    log.error(
      { err, cmd: interaction.commandName, guild: interaction.guildId, user: interaction.user?.id },
      "command error",
    );

    // If the interaction is already expired or acknowledged, there's nothing to do.
    const code = err?.code;
    if (code === 10062 /* Unknown interaction */ || code === 40060 /* already acknowledged */) {
      return;
    }

    const reply = { content: "Command failed.", flags: MessageFlags.Ephemeral };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch {
      // swallow any secondary errors
    }
  } finally {
    // Log command execution to database (async, don't block)
    const duration = Date.now() - startTime;
    db.insert(commandLogs)
      .values({
        id: nanoid(),
        command: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        success,
        error: errorMessage,
        metadata: {
          duration,
          options: interaction.options.data,
        },
      })
      .catch((err) => {
        log.error({ err, command: interaction.commandName }, "failed to log command to database");
      });
  }
}
