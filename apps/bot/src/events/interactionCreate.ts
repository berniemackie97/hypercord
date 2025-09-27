import { Events, Collection } from "discord.js";
import { commands } from "../core/client.js";
import { log } from "../core/logger.js";

export const name = Events.InteractionCreate;
export const once = false;
export async function execute(interaction: any) {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;
  try { await cmd.execute(interaction); }
  catch (err) {
    log.error({ err }, "command error");
    const reply = { content: "Command failed.", ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(reply);
    else await interaction.reply(reply);
  }
}
