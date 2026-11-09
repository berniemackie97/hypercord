import { describe, it, expect } from "vitest";
import { env, envSchema } from "../config.js";

describe("Config", () => {
  it("should export parsed environment variables", () => {
    expect(env).toBeDefined();
    expect(env.BOT_TOKEN).toBeDefined();
    expect(env.CLIENT_ID).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.REDIS_URL).toBeDefined();
  });

  it("should parse ADMIN_USER_IDS as array if present", () => {
    if (env.ADMIN_USER_IDS) {
      expect(Array.isArray(env.ADMIN_USER_IDS)).toBe(true);
    }
  });

  it("should parse ADMIN_ROLE_IDS as array if present", () => {
    if (env.ADMIN_ROLE_IDS) {
      expect(Array.isArray(env.ADMIN_ROLE_IDS)).toBe(true);
    }
  });

  it("should handle optional GUILD_ID", () => {
    // GUILD_ID should be optional
    expect(env.GUILD_ID === undefined || typeof env.GUILD_ID === "string").toBe(true);
  });

  it("should have required fields as strings", () => {
    expect(typeof env.BOT_TOKEN).toBe("string");
    expect(typeof env.CLIENT_ID).toBe("string");
    expect(typeof env.DATABASE_URL).toBe("string");
    expect(typeof env.REDIS_URL).toBe("string");
  });
});

describe("Environment validation", () => {
  const valid = {
    BOT_TOKEN: "bot-token",
    CLIENT_ID: "application-id",
    DATABASE_URL: "postgresql://user:password@localhost:5432/hypercord",
    REDIS_URL: "redis://localhost:6379",
  };

  it.each(["BOT_TOKEN", "CLIENT_ID", "DATABASE_URL", "REDIS_URL"])(
    "rejects a blank %s",
    (key) => {
      expect(envSchema.safeParse({ ...valid, [key]: "  " }).success).toBe(false);
    }
  );

  it("opts in to message content only when explicitly enabled", () => {
    expect(envSchema.parse(valid).MESSAGE_CONTENT_ENABLED).toBe(false);
    expect(envSchema.parse({ ...valid, MESSAGE_CONTENT_ENABLED: "false" }).MESSAGE_CONTENT_ENABLED).toBe(false);
    expect(envSchema.parse({ ...valid, MESSAGE_CONTENT_ENABLED: "true" }).MESSAGE_CONTENT_ENABLED).toBe(true);
    expect(envSchema.safeParse({ ...valid, MESSAGE_CONTENT_ENABLED: "1" }).success).toBe(false);
  });

  it("trims allowlist IDs and ignores empty entries", () => {
    const result = envSchema.parse({
      ...valid,
      ADMIN_USER_IDS: " 123, , 456 ",
      ADMIN_ROLE_IDS: " ",
    });
    expect(result.ADMIN_USER_IDS).toEqual(["123", "456"]);
    expect(result.ADMIN_ROLE_IDS).toEqual([]);
  });
});
