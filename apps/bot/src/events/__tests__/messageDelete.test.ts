import { describe, expect, it, vi } from "vitest";
import type { Message, PartialMessage } from "discord.js";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({
  db: { update: mocks.update },
}));

import { execute } from "../messageDelete.js";

describe("MessageDelete", () => {
  it("records deletions when Discord supplies only a partial message", async () => {
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.where.mockResolvedValue(undefined);

    const message = {
      id: "123",
      guildId: "guild-1",
      channelId: "channel-1",
      author: null,
      partial: true,
    } as unknown as PartialMessage;

    await execute(message);

    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledWith({ deletedAt: expect.any(Date) });
    expect(mocks.where).toHaveBeenCalledOnce();
  });

  it("ignores messages outside a guild", async () => {
    mocks.update.mockClear();
    const message = { id: "123", guildId: null, partial: true } as unknown as Message;
    await execute(message);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
