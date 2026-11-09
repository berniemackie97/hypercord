import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { log } from "./logger.js";

export async function sendPrivateError(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  const safeContent = content.slice(0, 1800);
  const allowedMentions = { parse: [] as [] };
  try {
    if (interaction.deferred) {
      await interaction.editReply({ content: safeContent, allowedMentions });
    } else if (interaction.replied) {
      await interaction.followUp({
        content: safeContent,
        allowedMentions,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: safeContent,
        allowedMentions,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    log.warn({ error, command: interaction.commandName }, "unable to deliver command error");
  }
}
