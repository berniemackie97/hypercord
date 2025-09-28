import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL!);

export const data = new SlashCommandBuilder()
  .setName("diagnose")
  .setDescription("Run health checks (Discord WS, Postgres, Redis).")

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const wsMs = Math.max(0, interaction.client.ws.ping);

  // Postgres
  let dbMs = -1, redisMs = -1, okDb = false, okRedis = false;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbMs = Date.now() - t0;
    okDb = true;
  } catch {}

  // Redis
  try {
    const t0 = Date.now();
    await redis.ping();
    redisMs = Date.now() - t0;
    okRedis = true;
  } catch {}

  const embed = new EmbedBuilder()
    .setTitle("Hypercord Diagnostics")
    .setDescription("Latency snapshot (lower is better).")
    .addFields(
      { name: "Gateway WS", value: `${wsMs} ms`, inline: true },
      { name: "Postgres", value: okDb ? `${dbMs} ms ✅` : "failed ❌", inline: true },
      { name: "Redis", value: okRedis ? `${redisMs} ms ✅` : "failed ❌", inline: true },
    )
    .setFooter({ text: `Bot v${process.env.npm_package_version ?? "dev"}` })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [embed] });
}
