import type { Client } from "discord.js";
import { commands } from "../core/client.js";
import { log } from "../core/logger.js";
import { commandModules, eventModules } from "./catalog.js";

export async function loadCommands(): Promise<void> {
  commands.clear();

  for (const command of commandModules) {
    if (!command.data?.name || typeof command.execute !== "function") {
      throw new Error("Command catalog contains an invalid command");
    }
    if (commands.has(command.data.name)) {
      throw new Error(`Duplicate command: ${command.data.name}`);
    }
    commands.set(command.data.name, { data: command.data, execute: command.execute });
  }

  log.info({ count: commands.size }, "commands loaded");
}

export async function loadEvents(client: Client): Promise<void> {
  const names = new Set<string>();

  for (const event of eventModules) {
    if (!event.name || typeof event.execute !== "function") {
      throw new Error("Event catalog contains an invalid handler");
    }
    if (names.has(event.name)) {
      throw new Error(`Duplicate event handler: ${event.name}`);
    }
    names.add(event.name);

    const listener = (...args: unknown[]) => {
      try {
        Promise.resolve((event.execute as (...args: unknown[]) => unknown)(...args)).catch(
          (error) => log.error({ error, event: event.name }, "event handler failed")
        );
      } catch (error) {
        log.error({ error, event: event.name }, "event handler failed");
      }
    };

    if ("once" in event && event.once) {
      client.once(event.name, listener);
    } else {
      client.on(event.name, listener);
    }
  }

  log.info({ count: names.size }, "events loaded");
}
