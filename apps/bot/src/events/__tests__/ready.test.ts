import { describe, it, expect, vi } from "vitest";
import { Events } from "discord.js";

// Mock the database module
vi.mock("../../db/index.js", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    raw: vi.fn((sql: string) => sql),
  },
}));

// Mock the queue module
vi.mock("../../queue/index.js", () => ({
  queues: {
    dailyStats: {
      add: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { name, once, execute } from "../ready.js";

describe("Ready Event", () => {
  it("should have correct event name", () => {
    expect(name).toBe(Events.ClientReady);
  });

  it("should be a once event", () => {
    expect(once).toBe(true);
  });

  it("should have an execute function", () => {
    expect(execute).toBeDefined();
    expect(typeof execute).toBe("function");
  });

  it("should execute without errors", async () => {
    const mockClient: any = {
      user: { tag: "TestBot#0000" },
      guilds: {
        cache: new Map([
          [
            "123456789",
            {
              id: "123456789",
              name: "Test Guild",
              ownerId: "987654321",
              joinedAt: new Date(),
            },
          ],
        ]),
      },
    };

    await expect(execute(mockClient)).resolves.toBeUndefined();
  });
});
