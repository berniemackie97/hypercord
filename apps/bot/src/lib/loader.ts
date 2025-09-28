import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { commands } from "../core/client.js";
import { log } from "../core/logger.js";

/**
 * Dynamic ESM loader that works cross-platform and with tsx.
 * Loads both .ts and .js files (dev vs build).
 */
export async function loadCommands() {
  const base = new URL("../commands/", import.meta.url);
  const dirPath = fileURLToPath(base);
  const files = readdirSync(dirPath).filter((f) => /\.(ts|js)$/.test(f));

  commands.clear();
  for (const f of files) {
    const modUrl = new URL(f, base); // safe URL join
    const mod = await import(modUrl.href);
    if (!mod?.data || !mod?.execute) continue;

    const name = mod.data.name;
    if (commands.has(name)) {
      log.warn({ name, file: f }, "duplicate command name");
    }
    commands.set(name, { data: mod.data, execute: mod.execute });
  }
  log.info({ count: commands.size }, "commands loaded");
}

export async function loadEvents(client: any) {
  const base = new URL("../events/", import.meta.url);
  const dirPath = fileURLToPath(base);
  const files = readdirSync(dirPath).filter((f) => /\.(ts|js)$/.test(f));

  for (const f of files) {
    const modUrl = new URL(f, base);
    const mod = await import(modUrl.href);
    if (mod?.once) client.once(mod.name, (...args: any[]) => mod.execute(...args));
    else client.on(mod.name, (...args: any[]) => mod.execute(...args));
  }
  log.info({ count: files.length }, "events loaded");
}
