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
});
