import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GuildMember } from "discord.js";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  getGuildConfig: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({
  db: { update: mocks.update },
}));
vi.mock("../../core/guildConfig.js", () => ({
  getGuildConfig: mocks.getGuildConfig,
}));

import { execute } from "../guildMemberRemove.js";

describe("Guild member removal", () => {
  beforeEach(() => {
    mocks.update.mockReset().mockReturnValue({ set: mocks.set });
    mocks.set.mockReset().mockReturnValue({ where: mocks.where });
    mocks.where.mockReset().mockResolvedValue([]);
    mocks.getGuildConfig.mockReset().mockResolvedValue({});
  });

  it("marks membership inactive and records the departure", async () => {
    const member = {
      guild: { id: "guild-1", memberCount: 3 },
      user: { id: "user-1" },
    } as unknown as GuildMember;

    await execute(member);

    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledWith({
      isActive: false,
      leftAt: expect.any(Date),
    });
    expect(mocks.where).toHaveBeenCalledOnce();
    expect(mocks.getGuildConfig).toHaveBeenCalledWith("guild-1");
  });

  it("sends a configured departure notification to a guild text channel", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockResolvedValue({
      isTextBased: () => true,
      send,
    });
    mocks.getGuildConfig.mockResolvedValue({ leaveChannel: "leave-channel" });

    const member = {
      guild: { id: "guild-1", memberCount: 3, channels: { fetch } },
      user: {
        id: "user-1",
        tag: "FormerMember",
        displayAvatarURL: () => "https://example.com/avatar.png",
      },
      joinedAt: null,
    } as unknown as GuildMember;

    await execute(member);

    expect(fetch).toHaveBeenCalledWith("leave-channel");
    expect(send).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
    expect(mocks.set).toHaveBeenCalledWith({
      isActive: false,
      leftAt: expect.any(Date),
    });
  });

  it("continues departure handling when the database is unavailable", async () => {
    mocks.where.mockRejectedValue(new Error("Database offline"));
    const member = {
      guild: { id: "guild-1", memberCount: 2 },
      user: { id: "user-1" },
    } as unknown as GuildMember;

    await expect(execute(member)).resolves.toBeUndefined();
    expect(mocks.getGuildConfig).toHaveBeenCalledWith("guild-1");
  });
});
