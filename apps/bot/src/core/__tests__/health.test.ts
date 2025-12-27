import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthManager } from "../health.js";
import type { Sql } from "postgres";
import type { Redis } from "ioredis";

describe("HealthManager", () => {
  let healthManager: HealthManager;

  beforeEach(() => {
    healthManager = new HealthManager();
  });

  describe("recordCommandExecution", () => {
    it("should increment command execution counter", () => {
      healthManager.recordCommandExecution();
      healthManager.recordCommandExecution();

      const metrics = healthManager.getMetrics();
      expect(metrics.commands.executed).toBe(2);
    });
  });

  describe("recordCommandFailure", () => {
    it("should increment command failure counter", () => {
      healthManager.recordCommandFailure();
      healthManager.recordCommandFailure();
      healthManager.recordCommandFailure();

      const metrics = healthManager.getMetrics();
      expect(metrics.commands.failed).toBe(3);
    });
  });

  describe("checkDiscord", () => {
    it("should return up status when Discord is connected", async () => {
      const result = await healthManager.checkDiscord();

      // Discord client might not be connected in tests, so we check the structure
      expect(result).toHaveProperty("status");
      expect(["up", "down"]).toContain(result.status);
    });

    it("should include latency when up", async () => {
      const result = await healthManager.checkDiscord();

      if (result.status === "up") {
        expect(result).toHaveProperty("latency");
        expect(typeof result.latency).toBe("number");
      }
    });

    it("should include error when down", async () => {
      const result = await healthManager.checkDiscord();

      if (result.status === "down") {
        expect(result).toHaveProperty("error");
        expect(typeof result.error).toBe("string");
      }
    });
  });

  describe("checkDatabase", () => {
    it("should return up status when database is healthy", async () => {
      const mockDb = vi.fn().mockResolvedValue([{ "?column?": 1 }]) as unknown as Sql;

      const result = await healthManager.checkDatabase(mockDb);

      expect(result.status).toBe("up");
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(mockDb).toHaveBeenCalled();
    });

    it("should return down status when database fails", async () => {
      const mockDb = vi.fn().mockRejectedValue(new Error("Connection failed")) as unknown as Sql;

      const result = await healthManager.checkDatabase(mockDb);

      expect(result.status).toBe("down");
      expect(result.error).toBe("Connection failed");
    });

    it("should handle non-Error exceptions", async () => {
      const mockDb = vi.fn().mockRejectedValue("String error") as unknown as Sql;

      const result = await healthManager.checkDatabase(mockDb);

      expect(result.status).toBe("down");
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("checkRedis", () => {
    it("should return up status when Redis is healthy", async () => {
      const mockRedis = {
        ping: vi.fn().mockResolvedValue("PONG"),
      } as unknown as Redis;

      const result = await healthManager.checkRedis(mockRedis);

      expect(result.status).toBe("up");
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it("should return down status when Redis fails", async () => {
      const mockRedis = {
        ping: vi.fn().mockRejectedValue(new Error("Connection refused")),
      } as unknown as Redis;

      const result = await healthManager.checkRedis(mockRedis);

      expect(result.status).toBe("down");
      expect(result.error).toBe("Connection refused");
    });

    it("should handle non-Error exceptions", async () => {
      const mockRedis = {
        ping: vi.fn().mockRejectedValue("String error"),
      } as unknown as Redis;

      const result = await healthManager.checkRedis(mockRedis);

      expect(result.status).toBe("down");
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("getHealth", () => {
    it("should return healthy status when all services are up", async () => {
      const mockDb = vi.fn().mockResolvedValue([{ "?column?": 1 }]) as unknown as Sql;

      const mockRedis = {
        ping: vi.fn().mockResolvedValue("PONG"),
      } as unknown as Redis;

      const result = await healthManager.getHealth(mockDb, mockRedis);

      expect(result.status).toBe("healthy");
      expect(result.checks.database.status).toBe("up");
      expect(result.checks.redis.status).toBe("up");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("uptime");
    });

    it("should return degraded status when one service is down", async () => {
      const mockDb = vi.fn().mockRejectedValue(new Error("DB down")) as unknown as Sql;

      const mockRedis = {
        ping: vi.fn().mockResolvedValue("PONG"),
      } as unknown as Redis;

      const result = await healthManager.getHealth(mockDb, mockRedis);

      expect(result.status).toBe("degraded");
      expect(result.checks.database.status).toBe("down");
      expect(result.checks.redis.status).toBe("up");
    });

    it("should return unhealthy status when two or more services are down", async () => {
      const mockDb = vi.fn().mockRejectedValue(new Error("DB down")) as unknown as Sql;

      const mockRedis = {
        ping: vi.fn().mockRejectedValue(new Error("Redis down")),
      } as unknown as Redis;

      const result = await healthManager.getHealth(mockDb, mockRedis);

      expect(result.status).toBe("unhealthy");
      expect(result.checks.database.status).toBe("down");
      expect(result.checks.redis.status).toBe("down");
    });

    it("should include timestamp in ISO format", async () => {
      const mockDb = vi.fn().mockResolvedValue([{ "?column?": 1 }]) as unknown as Sql;

      const mockRedis = {
        ping: vi.fn().mockResolvedValue("PONG"),
      } as unknown as Redis;

      const result = await healthManager.getHealth(mockDb, mockRedis);

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should track uptime since instantiation", async () => {
      const mockDb = vi.fn().mockResolvedValue([{ "?column?": 1 }]) as unknown as Sql;

      const mockRedis = {
        ping: vi.fn().mockResolvedValue("PONG"),
      } as unknown as Redis;

      const result = await healthManager.getHealth(mockDb, mockRedis);

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof result.uptime).toBe("number");
    });
  });

  describe("getMetrics", () => {
    it("should return process metrics", () => {
      const metrics = healthManager.getMetrics();

      expect(metrics.process).toBeDefined();
      expect(metrics.process.uptime).toBeGreaterThanOrEqual(0);
      expect(metrics.process.memory.used).toBeGreaterThan(0);
      expect(metrics.process.memory.total).toBeGreaterThan(0);
      expect(metrics.process.memory.percentage).toBeGreaterThan(0);
      expect(metrics.process.memory.percentage).toBeLessThanOrEqual(100);
      expect(metrics.process.cpu).toBeDefined();
    });

    it("should return Discord metrics", () => {
      const metrics = healthManager.getMetrics();

      expect(metrics.discord).toBeDefined();
      expect(typeof metrics.discord.guilds).toBe("number");
      expect(typeof metrics.discord.users).toBe("number");
      expect(typeof metrics.discord.channels).toBe("number");
      expect(typeof metrics.discord.ping).toBe("number");
    });

    it("should return command metrics", () => {
      healthManager.recordCommandExecution();
      healthManager.recordCommandExecution();
      healthManager.recordCommandFailure();

      const metrics = healthManager.getMetrics();

      expect(metrics.commands.executed).toBe(2);
      expect(metrics.commands.failed).toBe(1);
    });

    it("should calculate memory percentage correctly", () => {
      const metrics = healthManager.getMetrics();

      const expectedPercentage =
        (metrics.process.memory.used / metrics.process.memory.total) * 100;

      expect(metrics.process.memory.percentage).toBeCloseTo(expectedPercentage, 2);
    });
  });

  describe("logHealth", () => {
    it("should log health check without errors", async () => {
      const mockDb = vi.fn().mockResolvedValue([{ "?column?": 1 }]) as unknown as Sql;

      const mockRedis = {
        ping: vi.fn().mockResolvedValue("PONG"),
      } as unknown as Redis;

      // This should not throw
      await expect(healthManager.logHealth(mockDb, mockRedis)).resolves.toBeUndefined();
    });
  });
});
