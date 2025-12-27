import { db } from "../db/index.js";
import { guilds } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { log } from "./logger.js";

/**
 * Guild configuration schema
 */
export interface GuildConfig {
  modLogChannel?: string;
  welcomeChannel?: string;
  leaveChannel?: string;
  autoRole?: string;
  modRoles?: string[];
  prefix?: string;
  muteRole?: string;
  maxWarnings?: number;
  warnTimeoutDuration?: number; // in minutes
}

const defaultConfig: GuildConfig = {
  maxWarnings: 3,
  warnTimeoutDuration: 60, // 1 hour default
};

/**
 * Get guild configuration
 */
export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  try {
    const result = await db
      .select({ config: guilds.config })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (result.length === 0) {
      return defaultConfig;
    }

    return { ...defaultConfig, ...(result[0].config as GuildConfig) };
  } catch (err) {
    log.error({ err, guildId }, "failed to get guild config");
    return defaultConfig;
  }
}

/**
 * Update guild configuration
 */
export async function updateGuildConfig(
  guildId: string,
  updates: Partial<GuildConfig>
): Promise<boolean> {
  try {
    const currentConfig = await getGuildConfig(guildId);
    const newConfig = { ...currentConfig, ...updates };

    await db
      .update(guilds)
      .set({
        config: newConfig,
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guildId));

    return true;
  } catch (err) {
    log.error({ err, guildId, updates }, "failed to update guild config");
    return false;
  }
}

/**
 * Reset guild configuration to defaults
 */
export async function resetGuildConfig(guildId: string): Promise<boolean> {
  try {
    await db
      .update(guilds)
      .set({
        config: defaultConfig,
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guildId));

    return true;
  } catch (err) {
    log.error({ err, guildId }, "failed to reset guild config");
    return false;
  }
}

/**
 * Get specific config value with type safety
 */
export async function getConfigValue<K extends keyof GuildConfig>(
  guildId: string,
  key: K
): Promise<GuildConfig[K]> {
  const config = await getGuildConfig(guildId);
  return config[key];
}
