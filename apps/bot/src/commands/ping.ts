import { SlashCommandBuilder } from "discord.js";
export const data = new SlashCommandBuilder().setName("ping").setDescription("Pong with latency.");
export async function execute(interaction: import("discord.js").ChatInputCommandInteraction) {
  const sent = await interaction.reply({ content: "Pinging...", fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply(`Pong! Latency: ${latency}ms`);
}
