import { client } from "./core/client.js";
import { env } from "./core/config.js";
import { log } from "./core/logger.js";
import { loadCommands, loadEvents } from "./lib/loader.js";
import { startWorkers } from "./queue/index.js";

await loadCommands();
await loadEvents(client);

await client.login(env.BOT_TOKEN);

try {
  startWorkers(client); // start after login; if jobs misconfig, don’t kill the bot
} catch (err) {
  log.error({ err }, "failed to start workers");
}
