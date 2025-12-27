import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter, rateLimitMiddleware, cooldownMiddleware } from "../rateLimiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe("isRateLimited", () => {
    it("should not rate limit first request", () => {
      const result = limiter.isRateLimited("test", { max: 3, window: 60000 });
      expect(result).toBe(false);
    });

    it("should rate limit after max requests", () => {
      const config = { max: 3, window: 60000 };

      expect(limiter.isRateLimited("test", config)).toBe(false); // 1
      expect(limiter.isRateLimited("test", config)).toBe(false); // 2
      expect(limiter.isRateLimited("test", config)).toBe(false); // 3
      expect(limiter.isRateLimited("test", config)).toBe(true); // 4 - rate limited
    });

    it("should reset after window expires", async () => {
      const config = { max: 2, window: 100 }; // 100ms window

      expect(limiter.isRateLimited("test", config)).toBe(false);
      expect(limiter.isRateLimited("test", config)).toBe(false);
      expect(limiter.isRateLimited("test", config)).toBe(true); // rate limited

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(limiter.isRateLimited("test", config)).toBe(false); // reset
    });

    it("should track separate keys independently", () => {
      const config = { max: 2, window: 60000 };

      expect(limiter.isRateLimited("key1", config)).toBe(false);
      expect(limiter.isRateLimited("key1", config)).toBe(false);
      expect(limiter.isRateLimited("key1", config)).toBe(true); // key1 limited

      expect(limiter.isRateLimited("key2", config)).toBe(false); // key2 still ok
    });
  });

  describe("getInfo", () => {
    it("should return null for non-existent key", () => {
      const info = limiter.getInfo("nonexistent");
      expect(info).toBeNull();
    });

    it("should return info for existing key", () => {
      limiter.isRateLimited("test", { max: 3, window: 60000 });
      const info = limiter.getInfo("test");

      expect(info).not.toBeNull();
      expect(info?.remaining).toBe(1);
      expect(info?.resetAt).toBeGreaterThan(Date.now());
    });
  });

  describe("reset", () => {
    it("should reset rate limit for key", () => {
      const config = { max: 2, window: 60000 };

      limiter.isRateLimited("test", config);
      limiter.isRateLimited("test", config);
      expect(limiter.isRateLimited("test", config)).toBe(true); // limited

      limiter.reset("test");
      expect(limiter.isRateLimited("test", config)).toBe(false); // reset
    });
  });

  describe("clear", () => {
    it("should clear all rate limits", () => {
      const config = { max: 1, window: 60000 };

      limiter.isRateLimited("key1", config);
      limiter.isRateLimited("key2", config);

      expect(limiter.isRateLimited("key1", config)).toBe(true);
      expect(limiter.isRateLimited("key2", config)).toBe(true);

      limiter.clear();

      expect(limiter.isRateLimited("key1", config)).toBe(false);
      expect(limiter.isRateLimited("key2", config)).toBe(false);
    });
  });
});

describe("rateLimitMiddleware", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // Reset global limiter
    limiter = new RateLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it("should allow requests within limit", async () => {
    const middleware = rateLimitMiddleware({ max: 3, window: 60000 });
    const next = vi.fn();

    const interaction: any = {
      commandName: "test",
      user: { id: "123" },
    };

    await middleware(interaction, next);
    expect(next).toHaveBeenCalled();
  });

  it("should use user scope by default", async () => {
    const middleware = rateLimitMiddleware({ max: 1, window: 60000 });
    const next1 = vi.fn();
    const next2 = vi.fn();

    const interaction1: any = {
      commandName: "test",
      user: { id: "user1" },
    };

    const interaction2: any = {
      commandName: "test",
      user: { id: "user2" },
    };

    // Different users should have separate limits
    await middleware(interaction1, next1);
    await middleware(interaction2, next2);

    expect(next1).toHaveBeenCalled();
    expect(next2).toHaveBeenCalled();
  });

  it("should use guild scope when specified", async () => {
    const middleware = rateLimitMiddleware({ max: 1, window: 60000, scope: "guild" });
    const next1 = vi.fn();
    const next2 = vi.fn();

    const interaction1: any = {
      commandName: "test",
      user: { id: "user1" },
      guildId: "guild1",
      reply: vi.fn(),
    };

    const interaction2: any = {
      commandName: "test",
      user: { id: "user2" },
      guildId: "guild1", // Same guild
      reply: vi.fn(),
    };

    // First user uses the guild's limit
    await middleware(interaction1, next1);
    expect(next1).toHaveBeenCalled();

    // Second user in same guild should be rate limited
    await middleware(interaction2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(interaction2.reply).toHaveBeenCalledWith({
      content: expect.stringContaining("Slow down"),
      ephemeral: true,
    });
  });

  it("should use global scope when specified", async () => {
    const middleware = rateLimitMiddleware({ max: 1, window: 60000, scope: "global" });
    const next1 = vi.fn();
    const next2 = vi.fn();

    const interaction1: any = {
      commandName: "test",
      user: { id: "user1" },
      guildId: "guild1",
    };

    const interaction2: any = {
      commandName: "test",
      user: { id: "user2" },
      guildId: "guild2", // Different guild
      reply: vi.fn(),
    };

    // First request uses global limit
    await middleware(interaction1, next1);
    expect(next1).toHaveBeenCalled();

    // Second request should be rate limited (same global scope)
    await middleware(interaction2, next2);
    expect(next2).not.toHaveBeenCalled();
  });
});

describe("cooldownMiddleware", () => {
  it("should create rate limiter with correct config", async () => {
    const middleware = cooldownMiddleware(30, "user");
    const next = vi.fn();

    const interaction: any = {
      commandName: "cooldown-test",
      user: { id: "unique-user-999" }, // Use unique ID to avoid conflicts
      reply: vi.fn(),
    };

    await middleware(interaction, next);
    expect(next).toHaveBeenCalled();
  });
});
