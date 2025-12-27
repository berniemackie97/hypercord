import { describe, it, expect, vi } from "vitest";
import { name, once, execute } from "../interactionCreate.js";
import { Events } from "discord.js";
import { commands } from "../../core/client.js";

describe("InteractionCreate Event", () => {
  it("should have correct event name", () => {
    expect(name).toBe(Events.InteractionCreate);
  });

  it("should not be a once event", () => {
    expect(once).toBe(false);
  });

  it("should ignore non-command interactions", async () => {
    const interaction: any = {
      isChatInputCommand: vi.fn().mockReturnValue(false),
    };

    await execute(interaction);

    expect(interaction.isChatInputCommand).toHaveBeenCalled();
  });

  it("should return early if command not found", async () => {
    const interaction: any = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      commandName: "nonexistent-command-xyz",
      user: { id: "123" },
    };

    await execute(interaction);

    // Should return early without error
  });

  it("should execute registered command successfully", async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);

    // Temporarily add a test command
    commands.set("test-cmd-success", { execute: mockExecute } as any);

    const interaction: any = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      commandName: "test-cmd-success",
      user: { id: "123" },
      guildId: "456",
    };

    await execute(interaction);

    expect(mockExecute).toHaveBeenCalledWith(interaction);

    // Cleanup
    commands.delete("test-cmd-success");
  });

  it("should handle command errors with reply", async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error("Test error"));

    commands.set("test-cmd-error", { execute: mockExecute } as any);

    const interaction: any = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      commandName: "test-cmd-error",
      user: { id: "123" },
      guildId: "456",
      deferred: false,
      replied: false,
      reply: vi.fn().mockResolvedValue({}),
    };

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "Command failed.",
      flags: expect.any(Number),
    });

    commands.delete("test-cmd-error");
  });
});
