import { afterEach, describe, expect, it, vi } from "vitest";
import { ShutdownManager } from "../shutdown.js";

describe("ShutdownManager", () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes resources in registration order", async () => {
    const closed: string[] = [];
    const manager = new ShutdownManager();

    manager.register("workers", async () => { closed.push("workers"); });
    manager.register("queues", async () => { closed.push("queues"); });
    manager.register("database", async () => { closed.push("database"); });

    await manager.shutdown("SIGTERM");

    expect(closed).toEqual(["workers", "queues", "database"]);
  });

  it("runs handlers once on repeated shutdown requests", async () => {
    const manager = new ShutdownManager();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const close = vi.fn(() => gate);
    manager.register("workers", close);

    const first = manager.shutdown("SIGTERM");
    const second = manager.shutdown("SIGINT");
    expect(first).toBe(second);
    expect(manager.isShuttingDown).toBe(true);
    expect(() => manager.register("late", () => {})).toThrow(/after shutdown/);

    release();
    await first;
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("continues cleanup and exits with failure when a resource rejects", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const manager = new ShutdownManager();
    const closeDatabase = vi.fn();
    manager.register("workers", async () => { throw new Error("Redis failed"); });
    manager.register("database", closeDatabase);

    await manager.shutdown("SIGTERM");

    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("retains a fatal exit status across repeated shutdown requests", async () => {
    const manager = new ShutdownManager();
    const request = manager.shutdown("SIGTERM");
    const fatal = manager.shutdown("unhandledRejection", 1);
    expect(fatal).toBe(request);

    await request;
    expect(process.exitCode).toBe(1);
  });

  it("forces a nonzero exit after the drain deadline", async () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const manager = new ShutdownManager(50);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    manager.register("stuck worker", () => gate);

    const closing = manager.shutdown("SIGTERM");
    await vi.advanceTimersByTimeAsync(51);
    expect(exit).toHaveBeenCalledWith(1);

    release();
    await closing;
  });
});
