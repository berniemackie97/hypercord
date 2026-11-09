import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { Client } from "discord.js";

const mock = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../../../db/index.js", () => ({
  db: { update: mock.update },
}));

import { deliverReminder } from "../reminder.js";

const data = {
  reminderId: "reminder-123",
  channelId: "channel-123",
  userId: "user-123",
  what: "Review the release",
};

function job(): Job<Parameters<typeof deliverReminder>[0]["data"]> {
  return { data } as Job<typeof data>;
}

describe("reminder delivery", () => {
  beforeEach(() => {
    mock.update.mockReset().mockReturnValue({ set: mock.set });
    mock.set.mockReset().mockReturnValue({ where: mock.where });
    mock.where.mockReset().mockResolvedValue([]);
  });

  it("delivers to a guild channel before marking completion", async () => {
    const order: string[] = [];
    const send = vi.fn().mockImplementation(async () => { order.push("sent"); });
    mock.where.mockImplementation(async () => { order.push("completed"); });
    const client = {
      channels: { fetch: vi.fn().mockResolvedValue({ guildId: "guild-123", send }) },
      users: { fetch: vi.fn() },
    } as unknown as Client;

    await deliverReminder(job(), client);

    expect(order).toEqual(["sent", "completed"]);
    expect(mock.update).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      allowedMentions: { users: [data.userId], parse: [] },
    }));
  });

  it("does not mark failed deliveries complete", async () => {
    const send = vi.fn().mockRejectedValue(new Error("Discord unavailable"));
    const client = {
      channels: { fetch: vi.fn().mockResolvedValue({ guildId: "guild-123", send }) },
    } as unknown as Client;

    await expect(deliverReminder(job(), client)).rejects.toThrow("Discord unavailable");
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("falls back to a direct message when a channel is unavailable", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = {
      channels: { fetch: vi.fn().mockResolvedValue(null) },
      users: { fetch: vi.fn().mockResolvedValue({ send }) },
    } as unknown as Client;

    await deliverReminder(job(), client);

    expect(send).toHaveBeenCalledOnce();
    expect(mock.update).toHaveBeenCalledOnce();
  });

  it("surfaces a failed database completion update", async () => {
    mock.where.mockRejectedValue(new Error("PostgreSQL unavailable"));
    const client = {
      channels: { fetch: vi.fn().mockResolvedValue({ guildId: "guild-123", send: vi.fn() }) },
    } as unknown as Client;

    await expect(deliverReminder(job(), client)).rejects.toThrow("PostgreSQL unavailable");
  });
});
