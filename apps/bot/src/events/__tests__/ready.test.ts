import { describe, it, expect } from "vitest";
import { name, once, execute } from "../ready.js";
import { Events } from "discord.js";

describe("Ready Event", () => {
  it("should have correct event name", () => {
    expect(name).toBe(Events.ClientReady);
  });

  it("should be a once event", () => {
    expect(once).toBe(true);
  });

  it("should have an execute function", () => {
    expect(execute).toBeDefined();
    expect(typeof execute).toBe("function");
  });

  it("should execute without errors", async () => {
    const mockClient: any = {
      user: { tag: "TestBot#0000" },
    };

    await expect(execute(mockClient)).resolves.toBeUndefined();
  });
});
