import { client } from "./client.js";
import { log } from "./logger.js";
import type { Sql } from "postgres";
import type { Redis } from "ioredis";

/**
 * Health check result
 */
export interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    discord: HealthCheckDetail;
    database: HealthCheckDetail;
    redis: HealthCheckDetail;
  };
  timestamp: string;
  uptime: number;
}

/**
 * Individual health check detail
 */
export interface HealthCheckDetail {
  status: "up" | "down";
  latency?: number;
  error?: string;
}

/**
 * Metrics data
 */
export interface Metrics {
  process: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: NodeJS.CpuUsage;
  };
  discord: {
    guilds: number;
    users: number;
    channels: number;
    ping: number;
  };
  commands: {
    executed: number;
    failed: number;
  };
}

/**
 * Health and metrics manager
 */
export class HealthManager {
  private commandsExecuted = 0;
  private commandsFailed = 0;
  private startTime = Date.now();

  /**
   * Increment command execution counter
   */
  recordCommandExecution(): void {
    this.commandsExecuted++;
  }

  /**
   * Increment command failure counter
   */
  recordCommandFailure(): void {
    this.commandsFailed++;
  }

  /**
   * Check Discord connection health
   */
  async checkDiscord(): Promise<HealthCheckDetail> {
    try {
      const ping = client.ws.ping;

      if (ping < 0) {
        return {
          status: "down",
          error: "WebSocket not connected",
        };
      }

      return {
        status: "up",
        latency: ping,
      };
    } catch (error) {
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check database connection health
   */
  async checkDatabase(db: Sql): Promise<HealthCheckDetail> {
    try {
      const start = Date.now();
      await db`SELECT 1`;
      const latency = Date.now() - start;

      return {
        status: "up",
        latency,
      };
    } catch (error) {
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check Redis connection health
   */
  async checkRedis(redis: Redis): Promise<HealthCheckDetail> {
    try {
      const start = Date.now();
      await redis.ping();
      const latency = Date.now() - start;

      return {
        status: "up",
        latency,
      };
    } catch (error) {
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Perform full health check
   */
  async getHealth(db: Sql, redis: Redis): Promise<HealthCheck> {
    const [discord, database, redisCheck] = await Promise.all([
      this.checkDiscord(),
      this.checkDatabase(db),
      this.checkRedis(redis),
    ]);

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    const checks = { discord, database, redis: redisCheck };
    const downServices = Object.values(checks).filter((c) => c.status === "down").length;

    if (downServices >= 2) {
      status = "unhealthy";
    } else if (downServices === 1) {
      status = "degraded";
    }

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): Metrics {
    const memUsage = process.memoryUsage();

    return {
      process: {
        uptime: process.uptime(),
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
        cpu: process.cpuUsage(),
      },
      discord: {
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        channels: client.channels.cache.size,
        ping: client.ws.ping,
      },
      commands: {
        executed: this.commandsExecuted,
        failed: this.commandsFailed,
      },
    };
  }

  /**
   * Log health status
   */
  async logHealth(db: Sql, redis: Redis): Promise<void> {
    const health = await this.getHealth(db, redis);
    const metrics = this.getMetrics();

    log.info(
      {
        health,
        metrics,
      },
      "health check"
    );
  }
}

export const healthManager = new HealthManager();
