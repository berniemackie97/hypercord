import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commandModules } from "../src/lib/catalog.js";

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID?.trim();

  if (!token || !clientId) {
    throw new Error("BOT_TOKEN and CLIENT_ID are required to register commands");
  }

  const names = new Set<string>();
  const definitions = commandModules.map((command) => {
    if (!command.data?.name || typeof command.execute !== "function") {
      throw new Error("Command catalog contains an invalid command");
    }
    if (names.has(command.data.name)) {
      throw new Error(`Duplicate command: ${command.data.name}`);
    }
    names.add(command.data.name);
    return command.data.toJSON();
  });

  const rest = new REST({ version: "10" }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body: definitions });
  console.info(`Registered ${definitions.length} ${guildId ? "guild" : "global"} commands`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Command registration failed");
  process.exitCode = 1;
});
