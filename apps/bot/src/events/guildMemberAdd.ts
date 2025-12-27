import { Events, type GuildMember, EmbedBuilder } from "discord.js";
import { log } from "../core/logger.js";
import { getGuildConfig } from "../core/guildConfig.js";
import { ensureUser, ensureGuildMember } from "../db/utils.js";

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member: GuildMember) {
  const guild = member.guild;

  // Track member in database (async, don't block)
  ensureUser(member.user)
    .then(() => ensureGuildMember(member))
    .catch((err) => {
      log.error({ err, guild: guild.id, user: member.id }, "failed to track new member");
    });

  // Get guild config
  const config = await getGuildConfig(guild.id);

  // Send welcome message if configured
  if (config.welcomeChannel) {
    const channel = await guild.channels.fetch(config.welcomeChannel).catch(() => null);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle("👋 Welcome!")
        .setDescription(`Welcome to **${guild.name}**, ${member}!`)
        .setColor(0x00aa00)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          {
            name: "Account Created",
            value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          {
            name: "Member Count",
            value: `${guild.memberCount}`,
            inline: true,
          }
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch((err) => {
        log.error({ err, guild: guild.id, channel: config.welcomeChannel }, "failed to send welcome message");
      });
    }
  }

  // Auto-assign role if configured
  if (config.autoRole) {
    const role = await guild.roles.fetch(config.autoRole).catch(() => null);
    if (role) {
      await member.roles.add(role).catch((err) => {
        log.error({ err, guild: guild.id, role: config.autoRole }, "failed to assign auto-role");
      });
    }
  }

  log.info(
    {
      guild: guild.id,
      user: member.id,
      memberCount: guild.memberCount,
    },
    "member joined guild"
  );
}
