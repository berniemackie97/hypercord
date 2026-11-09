import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  type SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { log } from "./logger.js";
import { env } from "./config.js";

export type Command = {
  data: SlashCommandBuilder;
  execute: (i: ChatInputCommandInteraction) => Promise<void>;
};

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
];
if (env.MESSAGE_CONTENT_ENABLED) {
  intents.push(GatewayIntentBits.MessageContent);
}

export const client = new Client({
  intents,
  partials: [Partials.Channel, Partials.Message],
});

// registry
export const commands = new Collection<string, Command>();

export const rest = new REST({ version: "10" }).setToken(env.BOT_TOKEN);

// v14 still emits "ready"; v15 will rename to "clientReady".
// Keep "ready" for now; it’s stable on v14.
client.once("ready", (c) => {
  log.info({ user: c.user.tag }, "bot ready");
});
