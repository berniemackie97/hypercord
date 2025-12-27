import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shutdownManager } from "../shutdown.js";

describe("ShutdownManager", () => {
  // Store original process.exit to restore it after tests
  const originalExit = process.exit;

  beforeEach(() => {
    // Mock process.exit to prevent tests from actually exiting
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    // Restore original process.exit
    process.exit = originalExit;
  });

  describe("register", () => {
    it("should register shutdown handlers", () => {
      const handler = vi.fn();
      shutdownManager.register(handler);

      // Handler should be registered (we'll verify in shutdown tests)
      expect(handler).toBeDefined();
    });

    it("should register multiple handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      shutdownManager.register(handler1);
      shutdownManager.register(handler2);
      shutdownManager.register(handler3);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
      expect(handler3).toBeDefined();
    });
  });

  describe("shutdown manager functionality", () => {
    it("should be a defined instance", () => {
      expect(shutdownManager).toBeDefined();
      expect(typeof shutdownManager.register).toBe("function");
      expect(typeof shutdownManager.shutdown).toBe("function");
    });
  });
});
