import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
} from "discord.js";
import { log } from "./logger.js";
import { env } from "./config.js";
import type { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

export type Command = {
  data: SlashCommandBuilder;
  execute: (i: ChatInputCommandInteraction) => Promise<void>;
};

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // REQUIRED for guild.members.fetch() in /audit-perms
    // GatewayIntentBits.GuildMessages, // add if you plan to read/send normal messages frequently
  ],
  partials: [Partials.Channel],
});

// registry
export const commands = new Collection<string, Command>();

export const rest = new REST({ version: "10" }).setToken(env.BOT_TOKEN);

// v14 still emits "ready"; v15 will rename to "clientReady".
// Keep "ready" for now; it’s stable on v14.
client.once("ready", (c) => {
  log.info({ user: c.user.tag }, "bot ready");
});
