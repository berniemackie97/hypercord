import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validateOptions, validationMiddleware, schemas, getValidatedOptions } from "../validation.js";

describe("Validation", () => {
  describe("validateOptions", () => {
    it("should validate correct options", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const interaction: any = {
        options: {
          data: [
            { name: "name", value: "John" },
            { name: "age", value: 25 },
          ],
        },
      };

      const result = validateOptions(interaction, schema);

      expect(result).toEqual({ name: "John", age: 25 });
    });

    it("should throw ZodError for invalid options", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const interaction: any = {
        options: {
          data: [
            { name: "name", value: "John" },
            { name: "age", value: "not a number" },
          ],
        },
      };

      expect(() => validateOptions(interaction, schema)).toThrow(z.ZodError);
    });
  });

  describe("validationMiddleware", () => {
    it("should pass validated options to handler", async () => {
      const schema = z.object({
        name: z.string(),
      });

      const middleware = validationMiddleware(schema);
      const next = vi.fn();

      const interaction: any = {
        options: {
          data: [{ name: "name", value: "John" }],
        },
      };

      await middleware(interaction, next);

      expect(next).toHaveBeenCalled();
      expect(interaction.validatedOptions).toEqual({ name: "John" });
    });

    it("should handle validation errors with default handler", async () => {
      const schema = z.object({
        age: z.number(),
      });

      const middleware = validationMiddleware(schema);
      const next = vi.fn();

      const interaction: any = {
        options: {
          data: [{ name: "age", value: "invalid" }],
        },
        reply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(next).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("Validation Error"),
        ephemeral: true,
      });
    });

    it("should use custom error handler", async () => {
      const schema = z.object({
        age: z.number(),
      });

      const customErrorHandler = vi.fn();
      const middleware = validationMiddleware(schema, customErrorHandler);
      const next = vi.fn();

      const interaction: any = {
        options: {
          data: [{ name: "age", value: "invalid" }],
        },
      };

      await middleware(interaction, next);

      expect(next).not.toHaveBeenCalled();
      expect(customErrorHandler).toHaveBeenCalled();
    });
  });

  describe("schemas", () => {
    describe("snowflake", () => {
      it("should accept valid snowflake IDs", () => {
        expect(schemas.snowflake.parse("123456789012345678")).toBe("123456789012345678");
      });

      it("should reject invalid snowflake IDs", () => {
        expect(() => schemas.snowflake.parse("invalid")).toThrow();
        expect(() => schemas.snowflake.parse("123")).toThrow(); // too short
      });
    });

    describe("duration", () => {
      it("should accept valid duration strings", () => {
        expect(schemas.duration.parse("10s")).toBe("10s");
        expect(schemas.duration.parse("5m")).toBe("5m");
        expect(schemas.duration.parse("2h")).toBe("2h");
        expect(schemas.duration.parse("1d")).toBe("1d");
      });

      it("should reject invalid duration strings", () => {
        expect(() => schemas.duration.parse("invalid")).toThrow();
        expect(() => schemas.duration.parse("10x")).toThrow();
        expect(() => schemas.duration.parse("m10")).toThrow();
      });
    });

    describe("url", () => {
      it("should accept valid URLs", () => {
        expect(schemas.url.parse("https://example.com")).toBe("https://example.com");
        expect(schemas.url.parse("http://test.org/path")).toBe("http://test.org/path");
      });

      it("should reject invalid URLs", () => {
        expect(() => schemas.url.parse("not a url")).toThrow();
        expect(() => schemas.url.parse("example.com")).toThrow();
      });
    });

    describe("hexColor", () => {
      it("should accept valid hex colors", () => {
        expect(schemas.hexColor.parse("#FF0000")).toBe("#FF0000");
        expect(schemas.hexColor.parse("#00ff00")).toBe("#00ff00");
      });

      it("should reject invalid hex colors", () => {
        expect(() => schemas.hexColor.parse("FF0000")).toThrow(); // missing #
        expect(() => schemas.hexColor.parse("#FFF")).toThrow(); // too short
        expect(() => schemas.hexColor.parse("#GGGGGG")).toThrow(); // invalid chars
      });
    });

    describe("positiveInt", () => {
      it("should accept positive integers", () => {
        expect(schemas.positiveInt.parse(1)).toBe(1);
        expect(schemas.positiveInt.parse(100)).toBe(100);
      });

      it("should reject non-positive integers", () => {
        expect(() => schemas.positiveInt.parse(0)).toThrow();
        expect(() => schemas.positiveInt.parse(-1)).toThrow();
        expect(() => schemas.positiveInt.parse(1.5)).toThrow();
      });
    });

    describe("nonNegativeInt", () => {
      it("should accept non-negative integers", () => {
        expect(schemas.nonNegativeInt.parse(0)).toBe(0);
        expect(schemas.nonNegativeInt.parse(100)).toBe(100);
      });

      it("should reject negative integers", () => {
        expect(() => schemas.nonNegativeInt.parse(-1)).toThrow();
      });
    });

    describe("percentage", () => {
      it("should accept valid percentages", () => {
        expect(schemas.percentage.parse(0)).toBe(0);
        expect(schemas.percentage.parse(50)).toBe(50);
        expect(schemas.percentage.parse(100)).toBe(100);
      });

      it("should reject invalid percentages", () => {
        expect(() => schemas.percentage.parse(-1)).toThrow();
        expect(() => schemas.percentage.parse(101)).toThrow();
      });
    });
  });

  describe("getValidatedOptions", () => {
    it("should retrieve validated options", () => {
      const interaction: any = {
        validatedOptions: { name: "John", age: 25 },
      };

      const result = getValidatedOptions(interaction);

      expect(result).toEqual({ name: "John", age: 25 });
    });
  });
});
