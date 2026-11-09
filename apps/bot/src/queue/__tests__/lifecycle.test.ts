import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "discord.js";

const mocks = vi.hoisted(() => ({
  queueAdd: vi.fn(),
  queueClose: vi.fn(),
  workerClose: vi.fn(),
  workerOn: vi.fn(),
  redisQuit: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    add = mocks.queueAdd;
    close = mocks.queueClose;
  },
  Worker: class {
    close = mocks.workerClose;
    on = mocks.workerOn;
  },
}));

vi.mock("ioredis", () => ({
  default: class {
    quit = mocks.redisQuit;
  },
}));

vi.mock("../../db/index.js", () => ({ db: {} }));

import { closeQueues, startWorkers, stopWorkers } from "../index.js";

describe("background worker lifecycle", () => {
  beforeEach(() => {
    mocks.queueAdd.mockReset().mockResolvedValue({});
    mocks.queueClose.mockReset().mockResolvedValue(undefined);
    mocks.workerClose.mockReset().mockResolvedValue(undefined);
    mocks.workerOn.mockReset();
    mocks.redisQuit.mockReset().mockResolvedValue("OK");
  });

  it("awaits scheduling, prevents duplicate workers and drains workers before closing queues", async () => {
    await startWorkers({} as Client);
    expect(mocks.queueAdd).toHaveBeenCalledOnce();
    await expect(startWorkers({} as Client)).rejects.toThrow("already started");

    await stopWorkers();
    expect(mocks.workerClose).toHaveBeenCalledTimes(3);

    await closeQueues();
    expect(mocks.queueClose).toHaveBeenCalledTimes(4);
    expect(mocks.redisQuit).toHaveBeenCalledOnce();
  });

  it("reports worker-close failures after attempting to close every worker", async () => {
    await startWorkers({} as Client);
    mocks.workerClose.mockRejectedValueOnce(new Error("Lost Redis connection"));

    await expect(stopWorkers()).rejects.toThrow("Failed to drain background workers");
    expect(mocks.workerClose).toHaveBeenCalledTimes(3);
  });

  it("closes workers when shutdown races a pending schedule", async () => {
    let finish!: () => void;
    mocks.queueAdd.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finish = resolve; })
    );

    const starting = startWorkers({} as Client);
    await stopWorkers();
    finish();
    await starting;

    expect(mocks.workerClose).toHaveBeenCalledTimes(3);
  });
});
