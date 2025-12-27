import { describe, it, expect } from "vitest";
import { env } from "../config.js";

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
