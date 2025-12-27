import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, permissionMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { env } from "../core/config.js";

/**
 * Audit Permissions command - Security audit for dangerous permissions
 *
 * Features:
 * - Scans for roles with dangerous permissions
 * - Lists members with Administrator permission
 * - Identifies bots with elevated permissions
 * - Restricted to server managers
 * - Rate limited to prevent abuse
 */

const ADMIN_USERS = new Set(env.ADMIN_USER_IDS ?? []);
const ADMIN_ROLES = new Set(env.ADMIN_ROLE_IDS ?? []);

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.MentionEveryone,
];

function isAllowed(interaction: ChatInputCommandInteraction): boolean {
  // Check Discord ManageGuild permission
  const hasManageGuild =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (hasManageGuild) return true;

  // Check allowlist
  if (ADMIN_USERS.has(interaction.user.id)) return true;

  const member = interaction.member;
  const roleIds: string[] = Array.isArray((member as any)?.roles)
    ? ((member as any).roles as string[])
    : Array.from((member as any)?.roles?.cache?.keys?.() ?? []);

  return roleIds.some((r) => ADMIN_ROLES.has(r));
}

const commandData = new SlashCommandBuilder()
  .setName("audit-perms")
  .setDescription("Scan for dangerous roles and overprivileged members/bots")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(
    rateLimitMiddleware({
      max: 2,
      window: 60000, // 2 uses per minute
      scope: "guild",
    })
  )
  .setHandler(async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    // Additional permission check
    if (!isAllowed(interaction)) {
      await interaction.editReply({
        content: "❌ You don't have permission to run this command.",
      });
      return;
    }

    const guild = interaction.guild!;

    // Fetch all roles and members (requires GuildMembers intent)
    await guild.roles.fetch();
    await guild.members.fetch();

    // Find dangerous roles
    const dangerousRoles = guild.roles.cache
      .filter((r) => DANGEROUS_PERMISSIONS.some((f) => r.permissions.has(f)))
      .sort((a, b) => b.position - a.position)
      .map((r) => `• **@${r.name}** — ${r.members.size} members`)
      .slice(0, 15);

    // Find members with Administrator
    const adminMembers = guild.members.cache
      .filter((m) => m.permissions.has(PermissionFlagsBits.Administrator))
      .map((m) => `${m.user.bot ? "🤖" : "👤"} <@${m.id}>`)
      .slice(0, 20);

    // Find bots with Administrator
    const adminBots = guild.members.cache
      .filter((m) => m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator))
      .map((m) => `🤖 <@${m.id}>`)
      .slice(0, 20);

    const embed = new EmbedBuilder()
      .setTitle("🔒 Permission Audit")
      .setDescription(`Security audit for **${guild.name}**`)
      .setColor(0x5865f2)
      .addFields(
        {
          name: "Dangerous Roles (Top 15)",
          value: dangerousRoles.length ? dangerousRoles.join("\n") : "None found ✅",
        },
        {
          name: "Members with Administrator (Top 20)",
          value: adminMembers.length ? adminMembers.join(", ") : "None found ✅",
        },
        {
          name: "Bots with Administrator",
          value: adminBots.length ? adminBots.join(", ") : "None found ✅",
        }
      )
      .setFooter({
        text: `Audit requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
