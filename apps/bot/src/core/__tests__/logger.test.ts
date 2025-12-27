import { describe, it, expect } from "vitest";
import { log } from "../logger.js";

describe("Logger", () => {
  it("should export a logger instance", () => {
    expect(log).toBeDefined();
    expect(typeof log.info).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("should have a log level", () => {
    expect(log.level).toBeDefined();
    expect(typeof log.level).toBe("string");
  });

  it("should allow logging without errors", () => {
    expect(() => {
      log.info("test");
      log.error({ err: new Error("test") }, "error");
      log.warn("warning");
      log.debug("debug");
    }).not.toThrow();
  });

  it("should support structured logging", () => {
    expect(() => {
      log.info({ user: "123", command: "test" }, "command executed");
    }).not.toThrow();
  });
});
