import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeMiddleware,
  loggingMiddleware,
  permissionMiddleware,
  guildOnlyMiddleware,
  ownerOnlyMiddleware,
  deferMiddleware,
  errorHandlerMiddleware,
} from "../middleware.js";
import { PermissionFlagsBits } from "discord.js";

describe("Middleware System", () => {
  describe("executeMiddleware", () => {
    it("should execute middleware in order", async () => {
      const order: number[] = [];

      const middleware1 = vi.fn(async (interaction, next) => {
        order.push(1);
        await next();
      });

      const middleware2 = vi.fn(async (interaction, next) => {
        order.push(2);
        await next();
      });

      const handler = vi.fn(async () => {
        order.push(3);
      });

      const interaction: any = { commandName: "test" };

      await executeMiddleware(interaction, [middleware1, middleware2], handler);

      expect(order).toEqual([1, 2, 3]);
      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it("should stop execution if middleware doesn't call next", async () => {
      const middleware1 = vi.fn(async (interaction, next) => {
        // Don't call next
      });

      const handler = vi.fn();

      const interaction: any = { commandName: "test" };

      await executeMiddleware(interaction, [middleware1], handler);

      expect(middleware1).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle errors in middleware", async () => {
      const middleware1 = vi.fn(async () => {
        throw new Error("Test error");
      });

      const handler = vi.fn();
      const interaction: any = { commandName: "test", user: { id: "123" }, guildId: "456" };

      await expect(executeMiddleware(interaction, [middleware1], handler)).rejects.toThrow(
        "Test error"
      );
    });
  });

  describe("loggingMiddleware", () => {
    it("should log command execution", async () => {
      const middleware = loggingMiddleware();
      const next = vi.fn();

      const interaction: any = {
        commandName: "test",
        user: { tag: "User#0001", id: "123" },
        guild: { name: "Test Guild" },
        guildId: "456",
      };

      await middleware(interaction, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("permissionMiddleware", () => {
    it("should allow users with required permissions", async () => {
      const middleware = permissionMiddleware([PermissionFlagsBits.ManageGuild]);
      const next = vi.fn();

      const interaction: any = {
        guild: { id: "123" },
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(true),
          },
        },
      };

      await middleware(interaction, next);

      expect(next).toHaveBeenCalled();
    });

    it("should block users without required permissions", async () => {
      const middleware = permissionMiddleware([PermissionFlagsBits.ManageGuild]);
      const next = vi.fn();

      const interaction: any = {
        guild: { id: "123" },
        member: {
          permissions: {
            has: vi.fn().mockReturnValue(false),
          },
        },
        reply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(next).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("don't have permission"),
        ephemeral: true,
      });
    });

    it("should block in DMs", async () => {
      const middleware = permissionMiddleware([PermissionFlagsBits.ManageGuild]);
      const next = vi.fn();

      const interaction: any = {
        guild: null,
        member: null,
        reply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(next).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("only be used in a server"),
        ephemeral: true,
      });
    });
  });

  describe("guildOnlyMiddleware", () => {
    it("should allow guild interactions", async () => {
      const middleware = guildOnlyMiddleware();
      const next = vi.fn();

      const interaction: any = {
        guild: { id: "123" },
      };

      await middleware(interaction, next);

      expect(next).toHaveBeenCalled();
    });

    it("should block DM interactions", async () => {
      const middleware = guildOnlyMiddleware();
      const next = vi.fn();

      const interaction: any = {
        guild: null,
        reply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(next).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("only be used in a server"),
        ephemeral: true,
      });
    });
  });

  describe("ownerOnlyMiddleware", () => {
    it("should allow bot owners", async () => {
      const middleware = ownerOnlyMiddleware(["123", "456"]);
      const next = vi.fn();

      const interaction: any = {
        user: { id: "123" },
      };

      await middleware(interaction, next);

      expect(next).toHaveBeenCalled();
    });

    it("should block non-owners", async () => {
      const middleware = ownerOnlyMiddleware(["123", "456"]);
      const next = vi.fn();

      const interaction: any = {
        user: { id: "789" },
        reply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(next).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("bot owners only"),
        ephemeral: true,
      });
    });
  });

  describe("deferMiddleware", () => {
    it("should defer reply", async () => {
      const middleware = deferMiddleware();
      const next = vi.fn();

      const interaction: any = {
        deferReply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
      expect(next).toHaveBeenCalled();
    });

    it("should defer reply ephemerally when specified", async () => {
      const middleware = deferMiddleware(true);
      const next = vi.fn();

      const interaction: any = {
        deferReply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    });
  });

  describe("errorHandlerMiddleware", () => {
    it("should catch and handle errors", async () => {
      const middleware = errorHandlerMiddleware();
      const next = vi.fn().mockRejectedValue(new Error("Test error"));

      const interaction: any = {
        commandName: "test",
        user: { id: "123" },
        deferred: false,
        replied: false,
        reply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("Test error"),
        ephemeral: true,
      });
    });

    it("should edit reply if already deferred", async () => {
      const middleware = errorHandlerMiddleware();
      const next = vi.fn().mockRejectedValue(new Error("Test error"));

      const interaction: any = {
        commandName: "test",
        user: { id: "123" },
        deferred: true,
        replied: false,
        editReply: vi.fn(),
      };

      await middleware(interaction, next);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("Test error"),
      });
    });
  });
});
