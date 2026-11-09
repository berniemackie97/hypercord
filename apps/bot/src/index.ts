import { client } from "./core/client.js";
import { env } from "./core/config.js";
import { log } from "./core/logger.js";
import { rateLimiter } from "./core/rateLimiter.js";
import { setupShutdown, shutdownManager } from "./core/shutdown.js";
import { checkDatabaseConnection, closeDatabaseConnection } from "./db/index.js";
import { loadCommands, loadEvents } from "./lib/loader.js";
import { closeQueues, startWorkers, stopWorkers } from "./queue/index.js";

shutdownManager.register("workers", stopWorkers);
shutdownManager.register("queues and Redis", closeQueues);
shutdownManager.register("Discord client", () => client.destroy());
shutdownManager.register("PostgreSQL", closeDatabaseConnection);
shutdownManager.register("rate limiter", () => rateLimiter.destroy());
setupShutdown();

try {
  await loadCommands();
  await loadEvents(client);

  if (!(await checkDatabaseConnection())) {
    throw new Error("Database is unavailable");
  }

  await client.login(env.BOT_TOKEN);

  if (!shutdownManager.isShuttingDown) {
    await startWorkers(client);
    log.info("bot started");
  }
} catch (error) {
  log.fatal({ error }, "startup failed");
  await shutdownManager.shutdown("startup failure", 1);
}
