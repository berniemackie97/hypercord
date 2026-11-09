import { log } from "./logger.js";

type CloseHandler = () => Promise<void> | void;

export class ShutdownManager {
  private readonly handlers: { name: string; close: CloseHandler }[] = [];
  private running?: Promise<void>;

  constructor(private readonly deadlineMs = 25000) {}

  get isShuttingDown(): boolean {
    return this.running !== undefined;
  }

  register(name: string, close: CloseHandler): void {
    if (this.running) {
      throw new Error("Cannot register resources after shutdown has started");
    }
    this.handlers.push({ name, close });
  }

  shutdown(reason: string, exitCode = 0): Promise<void> {
    if (exitCode !== 0) {
      process.exitCode = 1;
    }
    if (!this.running) {
      this.running = Promise.resolve().then(() => this.run(reason));
    }
    return this.running;
  }

  private async run(reason: string): Promise<void> {
    log.info({ reason }, "shutting down");
    const deadline = setTimeout(() => {
      log.fatal({ reason, deadlineMs: this.deadlineMs }, "shutdown deadline exceeded");
      process.exit(1);
    }, this.deadlineMs);
    deadline.unref();

    let failed = false;
    try {
      for (const { name, close } of this.handlers) {
        try {
          await close();
        } catch (error) {
          failed = true;
          log.error({ error, resource: name }, "resource cleanup failed");
        }
      }
    } finally {
      clearTimeout(deadline);
    }

    if (failed) {
      log.fatal("shutdown finished with resource failures");
      process.exit(1);
    }
    log.info("shutdown finished");
  }
}

export const shutdownManager = new ShutdownManager();

let signalsRegistered = false;

export function setupShutdown(): void {
  if (signalsRegistered) return;
  signalsRegistered = true;

  process.on("SIGTERM", () => {
    void shutdownManager.shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdownManager.shutdown("SIGINT");
  });
  process.on("uncaughtException", (error) => {
    log.fatal({ error }, "uncaught exception");
    void shutdownManager.shutdown("uncaughtException", 1);
  });
  process.on("unhandledRejection", (reason) => {
    log.fatal({ reason }, "unhandled rejection");
    void shutdownManager.shutdown("unhandledRejection", 1);
  });
}
