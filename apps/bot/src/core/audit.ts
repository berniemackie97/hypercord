import { db } from "../db/index.js";
import { auditLogs } from "../db/schema.js";
import { log } from "./logger.js";
import { nanoid } from "nanoid";

export type AuditAction =
  | "ban"
  | "unban"
  | "kick"
  | "warn"
  | "timeout"
  | "role_add"
  | "role_remove"
  | "channel_create"
  | "channel_delete"
  | "message_delete"
  | "member_update"
  | "guild_update";

export interface AuditLogEntry {
  guildId: string;
  moderatorId: string;
  action: AuditAction;
  targetId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: nanoid(),
      guildId: entry.guildId,
      moderatorId: entry.moderatorId,
      action: entry.action,
      targetId: entry.targetId,
      reason: entry.reason,
      metadata: entry.metadata,
    });
  } catch (err) {
    log.error({ err, entry }, "failed to create audit log");
  }
}
