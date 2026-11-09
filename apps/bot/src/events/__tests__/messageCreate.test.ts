import { describe, expect, it, vi } from "vitest";
import type { Message } from "discord.js";

const dependencies = vi.hoisted(() => ({
  callAI: vi.fn(),
  checkQuota: vi.fn(),
  addXP: vi.fn(),
  insert: vi.fn(),
  roleFetch: vi.fn(),
  reply: vi.fn(),
  userAccess: vi.fn(),
  channelConfig: vi.fn(),
  afkStatus: vi.fn(),
}));

vi.mock("../../core/config.js", () => ({
  env: { MESSAGE_CONTENT_ENABLED: false },
}));
vi.mock("../../services/ai.js", () => ({
  callAI: dependencies.callAI,
  checkQuota: dependencies.checkQuota,
}));
vi.mock("../../utils/leveling.js", () => ({
  addXP: dependencies.addXP,
  calculateMessageXP: vi.fn(),
}));
vi.mock("../../core/guildConfig.js", () => ({ getGuildConfig: vi.fn() }));
vi.mock("../../core/audit.js", () => ({ createAuditLog: vi.fn() }));
vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "test-id") }));
vi.mock("../../db/index.js", () => ({
  db: {
    insert: dependencies.insert,
    query: {
      afkStatus: { findFirst: dependencies.afkStatus },
      aiUserAccess: { findFirst: dependencies.userAccess },
      aiChannelConfig: { findFirst: dependencies.channelConfig },
      guilds: { findFirst: vi.fn() },
    },
  },
}));

import { execute } from "../messageCreate.js";

describe("AI mention authorization", () => {
  it("denies a role-restricted channel before quota or provider access, even with a user override", async () => {
    dependencies.reply.mockReset().mockResolvedValue(undefined);
    dependencies.callAI.mockReset();
    dependencies.checkQuota.mockReset();
    dependencies.addXP.mockReset();
    dependencies.insert.mockReset();
    dependencies.afkStatus.mockResolvedValue(null);
    dependencies.userAccess.mockResolvedValue({
      provider: "gemini",
      model: "gemini-test",
      expiresAt: null,
      monthlyLimit: null,
    });
    dependencies.channelConfig.mockResolvedValue({
      provider: "gemini",
      model: "gemini-test",
      requiredRole: "role-1",
      enabled: true,
    });

    const message = {
      author: { id: "user-1", bot: false },
      member: null,
      guild: {
        id: "guild-1",
        roles: { cache: new Map() },
        members: { fetch: dependencies.roleFetch },
      },
      client: { user: { id: "bot-1" } },
      content: "<@bot-1> help",
      id: "message-1",
      channelId: "channel-1",
      mentions: { has: vi.fn().mockReturnValue(true), users: { size: 0 } },
      reply: dependencies.reply,
    } as unknown as Message;

    await execute(message);
    await vi.waitFor(() => expect(dependencies.reply).toHaveBeenCalledOnce());

    expect(dependencies.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("required role") }),
    );
    expect(dependencies.callAI).not.toHaveBeenCalled();
    expect(dependencies.checkQuota).not.toHaveBeenCalled();
    expect(dependencies.addXP).not.toHaveBeenCalled();
    expect(dependencies.insert).not.toHaveBeenCalled();
    expect(dependencies.roleFetch).not.toHaveBeenCalled();
  });
});
