import type { Message } from "discord.js";

export async function hasRequiredAiRole(
  message: Pick<Message, "guild" | "member" | "author">,
  requiredRole: string,
): Promise<boolean> {
  const guild = message.guild;
  if (!guild || !guild.roles.cache.has(requiredRole)) return false;

  const member = message.member?.id === message.author.id
    ? message.member
    : await guild.members.fetch(message.author.id).catch(() => null);

  return member?.roles.cache.has(requiredRole) ?? false;
}
