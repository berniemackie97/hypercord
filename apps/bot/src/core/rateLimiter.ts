import type { ChatInputCommandInteraction } from "discord.js";
import type { Middleware } from "./middleware.js";
import { log } from "./logger.js";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of uses */
  max: number;
  /** Time window in milliseconds */
  window: number;
  /** Scope of rate limit: 'user', 'guild', or 'global' */
  scope?: "user" | "guild" | "global";
  /** Custom message when rate limited */
  message?: string;
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if rate limit is exceeded
   * @param key - Unique key for this rate limit
   * @param config - Rate limit configuration
   * @returns True if rate limited, false otherwise
   */
  isRateLimited(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now >= entry.resetAt) {
      // No entry or expired, create new entry
      this.limits.set(key, {
        count: 1,
        resetAt: now + config.window,
      });
      return false;
    }

    if (entry.count >= config.max) {
      // Rate limited
      return true;
    }

    // Increment count
    entry.count++;
    this.limits.set(key, entry);
    return false;
  }

  /**
   * Get remaining uses and reset time
   * @param key - Unique key for this rate limit
   */
  getInfo(key: string): { remaining: number; resetAt: number } | null {
    const entry = this.limits.get(key);
    if (!entry) return null;

    return {
      remaining: Math.max(0, entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for a specific key
   * @param key - Unique key to reset
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.limits.delete(key);
    }

    if (toDelete.length > 0) {
      log.debug({ cleaned: toDelete.length }, "rate limiter cleanup");
    }
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

/**
 * Create a rate limiting middleware
 * @param config - Rate limit configuration
 */
export function rateLimitMiddleware(config: RateLimitConfig): Middleware {
  const scope = config.scope || "user";

  return async (interaction: ChatInputCommandInteraction, next) => {
    // Generate key based on scope
    let key: string;
    if (scope === "global") {
      key = `${interaction.commandName}:global`;
    } else if (scope === "guild" && interaction.guildId) {
      key = `${interaction.commandName}:guild:${interaction.guildId}`;
    } else {
      key = `${interaction.commandName}:user:${interaction.user.id}`;
    }

    // Check rate limit
    if (rateLimiter.isRateLimited(key, config)) {
      const info = rateLimiter.getInfo(key);
      const resetIn = info ? Math.ceil((info.resetAt - Date.now()) / 1000) : 0;

      const message =
        config.message || `⏱️ Slow down! You can use this command again in ${resetIn}s.`;

      await interaction.reply({
        content: message,
        ephemeral: true,
      });

      log.warn(
        {
          command: interaction.commandName,
          user: interaction.user.id,
          scope,
          resetIn,
        },
        "rate limit exceeded"
      );

      return;
    }

    await next();
  };
}

/**
 * Create a cooldown middleware (simpler version of rate limiting)
 * @param seconds - Cooldown duration in seconds
 * @param scope - Scope of cooldown
 */
export function cooldownMiddleware(
  seconds: number,
  scope: "user" | "guild" | "global" = "user"
): Middleware {
  return rateLimitMiddleware({
    max: 1,
    window: seconds * 1000,
    scope,
    message: `⏱️ This command is on cooldown. Please wait ${seconds}s.`,
  });
}
