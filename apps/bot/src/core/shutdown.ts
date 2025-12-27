import { log } from "./logger.js";
import { client } from "./client.js";
import { rateLimiter } from "./rateLimiter.js";

/**
 * Shutdown handler type
 */
type ShutdownHandler = () => Promise<void> | void;

/**
 * Shutdown manager for graceful cleanup
 */
class ShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;

  /**
   * Register a shutdown handler
   * @param handler - Function to call on shutdown
   */
  register(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Execute all shutdown handlers
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      log.warn("shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    log.info({ signal }, "received shutdown signal");

    // Execute all registered handlers
    for (const handler of this.handlers) {
      try {
        await handler();
      } catch (error) {
        log.error({ error }, "shutdown handler failed");
      }
    }

    log.info("shutdown complete");
    process.exit(0);
  }
}

export const shutdownManager = new ShutdownManager();

/**
 * Setup graceful shutdown handlers
 */
export function setupShutdown(): void {
  // Register core shutdown handlers
  shutdownManager.register(async () => {
    log.info("destroying Discord client");
    client.destroy();
  });

  shutdownManager.register(async () => {
    log.info("cleaning up rate limiter");
    rateLimiter.destroy();
  });

  // Handle shutdown signals
  process.on("SIGTERM", () => shutdownManager.shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdownManager.shutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    log.fatal({ error }, "uncaught exception");
    shutdownManager.shutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    log.fatal({ reason, promise }, "unhandled promise rejection");
    shutdownManager.shutdown("unhandledRejection");
  });

  log.info("shutdown handlers registered");
}
