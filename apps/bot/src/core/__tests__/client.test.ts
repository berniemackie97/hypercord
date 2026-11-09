import { describe, expect, it } from "vitest";
import { GatewayIntentBits, Partials } from "discord.js";
import { client } from "../client.js";
import { env } from "../config.js";

describe("Discord gateway configuration", () => {
  it("receives guild messages and guild member lifecycle events", () => {
    expect(client.options.intents.has(GatewayIntentBits.Guilds)).toBe(true);
    expect(client.options.intents.has(GatewayIntentBits.GuildMembers)).toBe(true);
    expect(client.options.intents.has(GatewayIntentBits.GuildMessages)).toBe(true);
  });

  it("requests full message content only with explicit configuration", () => {
    expect(client.options.intents.has(GatewayIntentBits.MessageContent))
      .toBe(env.MESSAGE_CONTENT_ENABLED);
  });

  it("supports cached and partial message deletes", () => {
    expect(client.options.partials).toContain(Partials.Message);
    expect(client.options.partials).toContain(Partials.Channel);
  });
});
