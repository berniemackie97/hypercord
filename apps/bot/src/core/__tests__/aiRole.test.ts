import { describe, expect, it, vi } from "vitest";
import type { Message } from "discord.js";
import { hasRequiredAiRole } from "../aiRole.js";

function makeMessage(
  roleExists: boolean,
  member: { id: string; hasRole: boolean } | null,
  fetched: { id: string; hasRole: boolean } | null = null,
) {
  const fetch = vi.fn().mockResolvedValue(
    fetched ? { id: fetched.id, roles: { cache: new Map(fetched.hasRole ? [["role-1", true]] : []) } } : null
  );
  const message = {
    author: { id: "user-1" },
    member: member
      ? { id: member.id, roles: { cache: new Map(member.hasRole ? [["role-1", true]] : []) } }
      : null,
    guild: {
      roles: { cache: new Map(roleExists ? [["role-1", true]] : []) },
      members: { fetch },
    },
  } as unknown as Pick<Message, "guild" | "member" | "author">;
  return { message, fetch };
}

describe("AI channel role authorization", () => {
  it("accepts the requesting member when their role exists", async () => {
    const { message, fetch } = makeMessage(true, { id: "user-1", hasRole: true });
    await expect(hasRequiredAiRole(message, "role-1")).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized member without an API lookup", async () => {
    const { message, fetch } = makeMessage(true, { id: "user-1", hasRole: false });
    await expect(hasRequiredAiRole(message, "role-1")).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("checks the message author rather than a different cached member", async () => {
    const { message, fetch } = makeMessage(true, { id: "someone-else", hasRole: true }, { id: "user-1", hasRole: false });
    await expect(hasRequiredAiRole(message, "role-1")).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledWith("user-1");
  });

  it("fails closed when the member is unavailable", async () => {
    const { message } = makeMessage(true, null);
    await expect(hasRequiredAiRole(message, "role-1")).resolves.toBe(false);
  });

  it("rejects deleted or unavailable roles", async () => {
    const { message, fetch } = makeMessage(false, { id: "user-1", hasRole: true });
    await expect(hasRequiredAiRole(message, "role-1")).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed when member fetching fails", async () => {
    const { message, fetch } = makeMessage(true, null);
    fetch.mockRejectedValue(new Error("Discord unavailable"));
    await expect(hasRequiredAiRole(message, "role-1")).resolves.toBe(false);
  });
});
