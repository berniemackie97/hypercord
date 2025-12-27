import { describe, it, expect, vi } from "vitest";
import { data, execute } from "../ping.js";

describe("Ping Command", () => {
  it("should have correct command metadata", () => {
    expect(data.name).toBe("ping");
    expect(data.description).toBe("Check bot latency and responsiveness");
  });

  it("should reply with pinging message then edit with embed", async () => {
    const mockReply = vi.fn().mockResolvedValue({
      createdTimestamp: 1050,
    });

    const mockEditReply = vi.fn().mockResolvedValue({});

    const interaction: any = {
      commandName: "ping",
      user: { id: "123", tag: "TestUser#0001" },
      createdTimestamp: 1000,
      reply: mockReply,
      editReply: mockEditReply,
      client: {
        ws: {
          ping: 42,
        },
      },
      guild: { shardId: 0 },
    };

    await execute(interaction);

    expect(mockReply).toHaveBeenCalledWith({
      content: "🏓 Pinging...",
      fetchReply: true,
    });

    expect(mockEditReply).toHaveBeenCalledWith({
      content: null,
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "🏓 Pong!",
          }),
        }),
      ]),
    });
  });

  it("should calculate correct latency for different timestamps", async () => {
    const mockReply = vi.fn().mockResolvedValue({
      createdTimestamp: 2150,
    });

    const mockEditReply = vi.fn().mockResolvedValue({});

    const interaction: any = {
      commandName: "ping",
      user: { id: "123", tag: "TestUser#0001" },
      createdTimestamp: 2000,
      reply: mockReply,
      editReply: mockEditReply,
      client: {
        ws: {
          ping: 75,
        },
      },
      guild: { shardId: 0 },
    };

    await execute(interaction);

    expect(mockEditReply).toHaveBeenCalledWith({
      content: null,
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: "Roundtrip Latency",
                value: "`150ms`",
              }),
            ]),
          }),
        }),
      ]),
    });
  });
});
