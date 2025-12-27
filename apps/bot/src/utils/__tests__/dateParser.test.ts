import { describe, it, expect } from "vitest";
import { parseDuration, formatDuration, isValidDuration } from "../dateParser.js";

describe("Date Parser Utils", () => {
  describe("parseDuration", () => {
    it("should parse seconds correctly", () => {
      expect(parseDuration("30s")).toBe(30 * 1000);
      expect(parseDuration("1s")).toBe(1000);
    });

    it("should parse minutes correctly", () => {
      expect(parseDuration("10m")).toBe(10 * 60 * 1000);
      expect(parseDuration("1m")).toBe(60 * 1000);
    });

    it("should parse hours correctly", () => {
      expect(parseDuration("2h")).toBe(2 * 60 * 60 * 1000);
      expect(parseDuration("1h")).toBe(60 * 60 * 1000);
    });

    it("should parse days correctly", () => {
      expect(parseDuration("3d")).toBe(3 * 24 * 60 * 60 * 1000);
      expect(parseDuration("1d")).toBe(24 * 60 * 60 * 1000);
    });

    it("should return null for invalid format", () => {
      expect(parseDuration("invalid")).toBeNull();
      expect(parseDuration("10")).toBeNull();
      expect(parseDuration("x")).toBeNull();
      expect(parseDuration("10x")).toBeNull();
      expect(parseDuration("")).toBeNull();
    });

    it("should handle large numbers", () => {
      expect(parseDuration("999d")).toBe(999 * 24 * 60 * 60 * 1000);
      expect(parseDuration("1000h")).toBe(1000 * 60 * 60 * 1000);
    });
  });

  describe("formatDuration", () => {
    it("should format days", () => {
      expect(formatDuration(24 * 60 * 60 * 1000)).toBe("1d");
      expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toBe("3d");
    });

    it("should format hours", () => {
      expect(formatDuration(60 * 60 * 1000)).toBe("1h");
      expect(formatDuration(2 * 60 * 60 * 1000)).toBe("2h");
    });

    it("should format minutes", () => {
      expect(formatDuration(60 * 1000)).toBe("1m");
      expect(formatDuration(10 * 60 * 1000)).toBe("10m");
    });

    it("should format seconds", () => {
      expect(formatDuration(1000)).toBe("1s");
      expect(formatDuration(30 * 1000)).toBe("30s");
    });

    it("should prefer larger units", () => {
      expect(formatDuration(25 * 60 * 60 * 1000)).toBe("1d"); // 25 hours = 1 day
      expect(formatDuration(90 * 60 * 1000)).toBe("1h"); // 90 minutes = 1 hour
    });
  });

  describe("isValidDuration", () => {
    it("should return true for valid durations", () => {
      expect(isValidDuration(1000, 500, 5000)).toBe(true);
      expect(isValidDuration(5000, 5000, 10000)).toBe(true); // min boundary
      expect(isValidDuration(10000, 5000, 10000)).toBe(true); // max boundary
    });

    it("should return false for invalid durations", () => {
      expect(isValidDuration(100, 500, 5000)).toBe(false); // below min
      expect(isValidDuration(6000, 500, 5000)).toBe(false); // above max
    });

    it("should handle edge cases", () => {
      expect(isValidDuration(0, 0, 1000)).toBe(true);
      expect(isValidDuration(-1, 0, 1000)).toBe(false);
    });
  });
});
