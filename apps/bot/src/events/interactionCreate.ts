import { Events, MessageFlags } from "discord.js";
import { commands } from "../core/client.js";
import { log } from "../core/logger.js";

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: any) {
  if (!interaction.isChatInputCommand()) return;

  const cmd = commands.get(interaction.commandName);
  if (!cmd || typeof cmd.execute !== "function") return;

  try {
    // Strong rule: every command must ack in <3s. Most of your commands already defer.
    await cmd.execute(interaction);
  } catch (err: any) {
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
  }
}
