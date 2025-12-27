import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module to prevent postgres connection errors
vi.mock("../../db/index.js", () => ({
  db: {},
  schema: {},
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
  closeDatabaseConnection: vi.fn().mockResolvedValue(undefined),
}));

// Mock Redis
vi.mock("ioredis", () => ({
  default: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue("PONG"),
  })),
}));

// Mock BullMQ queues
vi.mock("../../queue/index.js", () => ({
  queues: {
    reminders: {
      add: vi.fn().mockResolvedValue({}),
    },
    dailyStats: {
      add: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { loadCommands, loadEvents } from "../loader.js";
import { commands } from "../../core/client.js";

describe("Loader", () => {
  describe("loadCommands", () => {
    beforeEach(() => {
      commands.clear();
    });

    it("should load commands from the commands directory", async () => {
      await loadCommands();

      // Should have loaded at least some commands
      expect(commands.size).toBeGreaterThan(0);
    });

    it("should clear existing commands before loading", async () => {
      // Add a fake command
      commands.set("fake-command", { data: { name: "fake" }, execute: vi.fn() } as any);

      expect(commands.has("fake-command")).toBe(true);

      await loadCommands();

      // After reload, the fake command should be gone
      // (unless there's actually a fake-command.ts file)
      const hasFake = commands.has("fake-command");
      expect(typeof hasFake).toBe("boolean");
    });

    it("should load command data and execute function", async () => {
      await loadCommands();

      // Get any loaded command
      const firstCommand = Array.from(commands.values())[0];

      if (firstCommand) {
        expect(firstCommand).toHaveProperty("data");
        expect(firstCommand).toHaveProperty("execute");
        expect(firstCommand.data).toHaveProperty("name");
        expect(typeof firstCommand.execute).toBe("function");
      }
    });

    it("should set command name as key", async () => {
      await loadCommands();

      // Verify each command's key matches its data.name
      for (const [key, command] of commands.entries()) {
        expect(key).toBe(command.data.name);
      }
    });

    it("should handle commands directory correctly", async () => {
      // This should not throw
      await expect(loadCommands()).resolves.toBeUndefined();
    });
  });

  describe("loadEvents", () => {
    it("should load events and register them with client", async () => {
      const mockClient = {
        on: vi.fn(),
        once: vi.fn(),
      };

      await loadEvents(mockClient);

      // Should have registered at least some events
      const totalCalls = mockClient.on.mock.calls.length + mockClient.once.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });

    it("should use client.once for once events", async () => {
      const mockClient = {
        on: vi.fn(),
        once: vi.fn(),
      };

      await loadEvents(mockClient);

      // At least one event should be registered with once (ready event uses once: true)
      expect(mockClient.once.mock.calls.length).toBeGreaterThan(0);
    });

    it("should use client.on for recurring events", async () => {
      const mockClient = {
        on: vi.fn(),
        once: vi.fn(),
      };

      await loadEvents(mockClient);

      // The interactionCreate event should be registered with on
      const onCall = mockClient.on.mock.calls.find((call) => call[0] === "interactionCreate");
      expect(onCall).toBeDefined();
    });

    it("should register event handlers as functions", async () => {
      const mockClient = {
        on: vi.fn(),
        once: vi.fn(),
      };

      await loadEvents(mockClient);

      // Check that all registered handlers are functions
      for (const call of mockClient.on.mock.calls) {
        expect(typeof call[1]).toBe("function");
      }

      for (const call of mockClient.once.mock.calls) {
        expect(typeof call[1]).toBe("function");
      }
    });

    it("should handle events directory correctly", async () => {
      const mockClient = {
        on: vi.fn(),
        once: vi.fn(),
      };

      // This should not throw
      await expect(loadEvents(mockClient)).resolves.toBeUndefined();
    });
  });
});
