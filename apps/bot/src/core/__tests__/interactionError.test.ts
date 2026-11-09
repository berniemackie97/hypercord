import { describe, expect, it, vi } from "vitest";
import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { sendPrivateError } from "../interactionError.js";

describe("private interaction errors", () => {
  it("acknowledges a fresh interaction ephemerally", async () => {
    const reply = vi.fn();
    const interaction = { replied: false, deferred: false, reply } as unknown as ChatInputCommandInteraction;
    await sendPrivateError(interaction, "Service failed");
    expect(reply).toHaveBeenCalledWith({
      content: "Service failed",
      allowedMentions: { parse: [] },
      flags: MessageFlags.Ephemeral,
    });
  });

  it("edits the pending deferred response", async () => {
    const editReply = vi.fn();
    const interaction = { replied: false, deferred: true, editReply } as unknown as ChatInputCommandInteraction;
    await sendPrivateError(interaction, "Service failed");
    expect(editReply).toHaveBeenCalledWith({
      content: "Service failed",
      allowedMentions: { parse: [] },
    });
  });

  it("sends an ephemeral follow-up after an existing reply", async () => {
    const followUp = vi.fn();
    const interaction = { replied: true, deferred: false, followUp } as unknown as ChatInputCommandInteraction;
    await sendPrivateError(interaction, "Service failed");
    expect(followUp).toHaveBeenCalledWith({
      content: "Service failed",
      allowedMentions: { parse: [] },
      flags: MessageFlags.Ephemeral,
    });
  });

  it("bounds message content and tolerates expired interactions", async () => {
    const reply = vi.fn().mockRejectedValue(new Error("Unknown interaction"));
    const interaction = { replied: false, deferred: false, reply } as unknown as ChatInputCommandInteraction;
    await expect(sendPrivateError(interaction, "x".repeat(4000))).resolves.toBeUndefined();
    expect(reply.mock.calls[0][0].content).toHaveLength(1800);
  });
});
