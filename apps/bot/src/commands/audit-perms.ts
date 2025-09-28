import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { env } from "../core/config.js";

/**
 * Optional allowlists from env:
 * ADMIN_USER_IDS="123,456"
 * ADMIN_ROLE_IDS="789,1011"
 */
const ADMIN_USERS = new Set(env.ADMIN_USER_IDS ?? []);
const ADMIN_ROLES = new Set(env.ADMIN_ROLE_IDS ?? []);

function isAllowed(interaction: ChatInputCommandInteraction) {
  // Built-in Discord gate: only members with ManageGuild can even see/use it
  const hasManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (hasManageGuild) return true;

  // Optional allowlists
  if (ADMIN_USERS.has(interaction.user.id)) return true;

  const member = interaction.member;
  // member?.roles?.valueOf() can be RoleManager or GuildMemberRoleManager depending on cache state
  const roleIds: string[] =
    Array.isArray((member as any)?.roles)
      ? ((member as any).roles as string[])
      : Array.from((member as any)?.roles?.cache?.keys?.() ?? []);

  return roleIds.some((r) => ADMIN_ROLES.has(r));
}

const DANGEROUS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.MentionEveryone,
];

export const data = new SlashCommandBuilder()
  .setName("audit-perms")
  .setDescription("Scan for dangerous roles and overprivileged members/bots.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // only managers see/use by default

export async function execute(interaction: ChatInputCommandInteraction) {
  // Always ack fast
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isAllowed(interaction)) {
    await interaction.editReply({ content: "You aren’t allowed to run this." });
    return;
  }

  // Ensure members are available; requires Server Members Intent in the dev portal + in client intents.
  const guild = interaction.guild!;
  await guild.roles.fetch();
  await guild.members.fetch(); // needs GatewayIntentBits.GuildMembers

  const dangerousRoles = guild.roles.cache
    .filter((r) => DANGEROUS.some((f) => r.permissions.has(f)))
    .sort((a, b) => b.position - a.position)
    .map((r) => `• **@${r.name}** — members: ${r.members.size}`)
    .slice(0, 15);

  const adminMembers = guild.members.cache
    .filter((m) => m.permissions.has(PermissionFlagsBits.Administrator))
    .map((m) => `${m.user.bot ? "🤖" : "👤"} <@${m.id}>`)
    .slice(0, 20);

  const adminBots = guild.members.cache
    .filter((m) => m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator))
    .map((m) => `🤖 <@${m.id}>`)
    .slice(0, 20);

  const embed = new EmbedBuilder()
    .setTitle("Permission Audit")
    .addFields(
      { name: "Dangerous roles (top 15)", value: dangerousRoles.length ? dangerousRoles.join("\n") : "None ✅" },
      { name: "Members with Administrator (top 20)", value: adminMembers.length ? adminMembers.join(", ") : "None ✅" },
      { name: "Bots with Administrator", value: adminBots.length ? adminBots.join(", ") : "None ✅" },
    )
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [embed] });
}
