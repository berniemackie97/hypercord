import { Events, type GuildMember, type PartialGuildMember, EmbedBuilder } from "discord.js";
import { log } from "../core/logger.js";
import { getGuildConfig } from "../core/guildConfig.js";
import { db } from "../db/index.js";
import { guildMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export const name = Events.GuildMemberRemove;
export const once = false;

export async function execute(member: GuildMember | PartialGuildMember) {
  const guild = member.guild;
  const user = member.user;

  // Update database to mark member as no longer in guild
  try {
    await db
      .update(guildMembers)
      .set({
        leftAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(guildMembers.userId, user.id), eq(guildMembers.guildId, guild.id)));
  } catch (err) {
    log.error({ err, guild: guild.id, user: user.id }, "failed to update member leave in database");
  }

  // Get guild config
  const config = await getGuildConfig(guild.id);

  // Send leave message if configured
  if (config.leaveChannel) {
    const channel = await guild.channels.fetch(config.leaveChannel).catch(() => null);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle("👋 Goodbye")
        .setDescription(`**${user.tag}** has left the server.`)
        .setColor(0xff6b6b)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          {
            name: "Joined",
            value: member.joinedAt
              ? `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`
              : "Unknown",
            inline: true,
          },
          {
            name: "Member Count",
            value: `${guild.memberCount}`,
            inline: true,
          }
        )
        .setFooter({ text: `User ID: ${user.id}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch((err) => {
        log.error({ err, guild: guild.id, channel: config.leaveChannel }, "failed to send leave message");
      });
    }
  }

  log.info(
    {
      guild: guild.id,
      user: user.id,
      memberCount: guild.memberCount,
    },
    "member left guild"
  );
}
