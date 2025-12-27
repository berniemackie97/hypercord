import { client } from "./core/client.js";
import { env } from "./core/config.js";
import { log } from "./core/logger.js";
import { loadCommands, loadEvents } from "./lib/loader.js";
import { startWorkers } from "./queue/index.js";
import { setupShutdown, shutdownManager } from "./core/shutdown.js";

// Setup graceful shutdown handlers
setupShutdown();

// Load commands and events
log.info("loading commands and events");
await loadCommands();
await loadEvents(client);

// Login to Discord
log.info("logging in to Discord");
await client.login(env.BOT_TOKEN);

// Start background workers
try {
  log.info("starting background workers");
  startWorkers(client); // start after login; if jobs misconfig, don't kill the bot
} catch (err) {
  log.error({ err }, "failed to start workers");
}

// Register worker cleanup on shutdown
shutdownManager.register(async () => {
  log.info("stopping background workers");
  // Worker cleanup will be handled automatically
});

log.info("bot is ready and running");

