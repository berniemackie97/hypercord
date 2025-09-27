import { SlashCommandBuilder } from "discord.js";
export const data = new SlashCommandBuilder().setName("about").setDescription("About this bot.");
export async function execute(interaction: import("discord.js").ChatInputCommandInteraction) {
  await interaction.reply({ content: "Hypercord — modern Discord bot scaffold. /ping to test." });
}
