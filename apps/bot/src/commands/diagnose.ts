import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, permissionMiddleware, guildOnlyMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL!);

/**
 * Diagnose command - System health checks for administrators
 *
 * Features:
 * - Discord WebSocket latency
 * - PostgreSQL connection and latency
 * - Redis connection and latency
 * - Restricted to administrators
 * - Rate limited to prevent abuse
 */
const commandData = new SlashCommandBuilder()
  .setName("diagnose")
  .setDescription("Run system health checks (Discord, Postgres, Redis)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.ManageGuild]))
  .use(
    rateLimitMiddleware({
      max: 3,
      window: 60000, // 3 uses per minute
      scope: "guild",
    })
  )
  .setHandler(async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    // Discord WebSocket
    const wsMs = Math.max(0, interaction.client.ws.ping);

    // PostgreSQL check
    let dbMs = -1;
    let okDb = false;
    try {
      const t0 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbMs = Date.now() - t0;
      okDb = true;
    } catch (error) {
      // Database connection failed
    }

    // Redis check
    let redisMs = -1;
    let okRedis = false;
    try {
      const t0 = Date.now();
      await redis.ping();
      redisMs = Date.now() - t0;
      okRedis = true;
    } catch (error) {
      // Redis connection failed
    }

    // Determine overall health status
    const failedServices = [!okDb, !okRedis].filter(Boolean).length;
    let status = "🟢 Healthy";
    let color = 0x00ff00;

    if (failedServices === 1) {
      status = "🟡 Degraded";
      color = 0xffff00;
    } else if (failedServices >= 2) {
      status = "🔴 Unhealthy";
      color = 0xff0000;
    }

    const embed = new EmbedBuilder()
      .setTitle("System Diagnostics")
      .setDescription(`**Status:** ${status}\n\nLatency snapshot (lower is better)`)
      .setColor(color)
      .addFields(
        {
          name: "Gateway WebSocket",
          value: `\`${wsMs}ms\``,
          inline: true,
        },
        {
          name: "PostgreSQL",
          value: okDb ? `\`${dbMs}ms\` ✅` : "`failed` ❌",
          inline: true,
        },
        {
          name: "Redis",
          value: okRedis ? `\`${redisMs}ms\` ✅` : "`failed` ❌",
          inline: true,
        }
      )
      .setFooter({ text: `Bot v${process.env.npm_package_version ?? "dev"}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  })
  .build();
