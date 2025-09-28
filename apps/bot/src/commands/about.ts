import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("About this bot.")
  .addStringOption(opt =>
    opt.setName("topic")
       .setDescription("What do you want to know?")
       .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const topic = interaction.options.getString("topic");
  // If you need longer than 3s, do: await interaction.deferReply({ ephemeral: true });
  await interaction.reply({ content: `About: ${topic ?? "general info"}`, ephemeral: true });
}