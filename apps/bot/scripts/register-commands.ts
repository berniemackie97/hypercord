import { REST, Routes } from "discord.js";
import { readdirSync } from "node:fs";
import path from "node:path";
import "dotenv/config";

const TOKEN = process.env.BOT_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const GUILD_ID = process.env.GUILD_ID; // optional for fast dev

async function main() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const cmds: any[] = [];

  const dir = new URL("../src/commands", import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith(".ts"));
  for (const f of files) {
    const mod = await import(path.join(dir.pathname, f));
    cmds.push(mod.data.toJSON());
  }

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: cmds });
    console.log(`Registered ${cmds.length} guild command(s) to ${GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: cmds });
    console.log(`Registered ${cmds.length} global command(s)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
