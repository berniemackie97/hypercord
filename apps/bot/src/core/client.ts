import { Client, GatewayIntentBits, Partials, Collection, REST, Routes } from "discord.js";
import { log } from "./logger.js";
import { env } from "./config.js";
import type { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

export type Command = {
  data: SlashCommandBuilder;
  execute: (i: ChatInputCommandInteraction) => Promise<void>;
};

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

// registry
export const commands = new Collection<string, Command>();

export const rest = new REST({ version: "10" }).setToken(env.BOT_TOKEN);

client.once("ready", (c) => { log.info({ user: c.user.tag }, "bot ready"); });
