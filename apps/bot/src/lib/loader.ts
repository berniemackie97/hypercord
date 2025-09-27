import { readdirSync } from "node:fs";
import path from "node:path";
import { commands } from "../core/client.js";
import { log } from "../core/logger.js";

export async function loadCommands() {
  const dir = new URL("../commands", import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith(".ts"));
  for (const f of files) {
    const mod = await import(path.join(dir.pathname, f));
    const cmd = { data: mod.data, execute: mod.execute };
    commands.set(cmd.data.name, cmd);
  }
  log.info({ count: commands.size }, "commands loaded");
}

export async function loadEvents(client: any) {
  const dir = new URL("../events", import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith(".ts"));
  for (const f of files) {
    const mod = await import(path.join(dir.pathname, f));
    if (mod.once) client.once(mod.name, (...args: any[]) => mod.execute(...args));
    else client.on(mod.name, (...args: any[]) => mod.execute(...args));
  }
  log.info({ count: files.length }, "events loaded");
}
