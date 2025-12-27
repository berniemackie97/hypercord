// ============================================
// Drizzle Database Client
// ============================================

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { env } from "../core/config.js";
import { log } from "../core/logger.js";

// Create PostgreSQL connection
const queryClient = postgres(env.DATABASE_URL, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Export schema for use in queries
export { schema };

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (error) {
    log.error({ error }, "Database connection check failed");
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await queryClient.end();
    log.info("Database connection closed");
  } catch (error) {
    log.error({ error }, "Error closing database connection");
  }
}
