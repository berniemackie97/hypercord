// ============================================
// Drizzle Schema for Hypercord Discord Bot
// ============================================

import { pgTable, text, timestamp, boolean, integer, jsonb, date, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// Core Tables
// ============================================

export const guilds = pgTable(
  "guilds",
  {
    id: text("id").primaryKey(), // Discord guild ID
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    leftAt: timestamp("left_at"),
    isActive: boolean("is_active").default(true).notNull(),
    config: jsonb("config").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("guilds_owner_id_idx").on(table.ownerId),
    activeIdx: index("guilds_is_active_idx").on(table.isActive),
  })
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // Discord user ID
    username: text("username").notNull(),
    globalName: text("global_name"),
    isBot: boolean("is_bot").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    usernameIdx: index("users_username_idx").on(table.username),
  })
);

export const guildMembers = pgTable(
  "guild_members",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    nickname: text("nickname"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    leftAt: timestamp("left_at"),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => ({
    userIdx: index("guild_members_user_id_idx").on(table.userId),
    guildIdx: index("guild_members_guild_id_idx").on(table.guildId),
    activeIdx: index("guild_members_is_active_idx").on(table.isActive),
    userGuildUnique: unique("guild_members_user_id_guild_id_key").on(table.userId, table.guildId),
  })
);

// ============================================
// Moderation Tables
// ============================================

export const warnings = pgTable(
  "warnings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => ({
    userIdx: index("warnings_user_id_idx").on(table.userId),
    guildIdx: index("warnings_guild_id_idx").on(table.guildId),
    moderatorIdx: index("warnings_moderator_id_idx").on(table.moderatorId),
    activeIdx: index("warnings_is_active_idx").on(table.isActive),
    expiresIdx: index("warnings_expires_at_idx").on(table.expiresAt),
  })
);

export const bans = pgTable(
  "bans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id").notNull(),
    reason: text("reason").notNull(),
    bannedAt: timestamp("banned_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    unbannedAt: timestamp("unbanned_at"),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => ({
    userIdx: index("bans_user_id_idx").on(table.userId),
    guildIdx: index("bans_guild_id_idx").on(table.guildId),
    moderatorIdx: index("bans_moderator_id_idx").on(table.moderatorId),
    activeIdx: index("bans_is_active_idx").on(table.isActive),
    expiresIdx: index("bans_expires_at_idx").on(table.expiresAt),
  })
);

export const kicks = pgTable(
  "kicks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id").notNull(),
    reason: text("reason").notNull(),
    kickedAt: timestamp("kicked_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("kicks_user_id_idx").on(table.userId),
    guildIdx: index("kicks_guild_id_idx").on(table.guildId),
    moderatorIdx: index("kicks_moderator_id_idx").on(table.moderatorId),
  })
);

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("notes_user_id_idx").on(table.userId),
    guildIdx: index("notes_guild_id_idx").on(table.guildId),
    moderatorIdx: index("notes_moderator_id_idx").on(table.moderatorId),
  })
);

// ============================================
// Feature Tables
// ============================================

export const reminders = pgTable(
  "reminders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    content: text("content").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    isCompleted: boolean("is_completed").default(false).notNull(),
  },
  (table) => ({
    userIdx: index("reminders_user_id_idx").on(table.userId),
    guildIdx: index("reminders_guild_id_idx").on(table.guildId),
    scheduledIdx: index("reminders_scheduled_for_idx").on(table.scheduledFor),
    completedIdx: index("reminders_is_completed_idx").on(table.isCompleted),
  })
);

export const customCommands = pgTable(
  "custom_commands",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    response: text("response").notNull(),
    creatorId: text("creator_id").notNull(),
    usageCount: integer("usage_count").default(0).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    guildIdx: index("custom_commands_guild_id_idx").on(table.guildId),
    enabledIdx: index("custom_commands_is_enabled_idx").on(table.isEnabled),
    guildNameUnique: unique("custom_commands_guild_id_name_key").on(table.guildId, table.name),
  })
);

// ============================================
// Logging Tables
// ============================================

export const commandLogs = pgTable(
  "command_logs",
  {
    id: text("id").primaryKey(),
    command: text("command").notNull(),
    userId: text("user_id").notNull(),
    guildId: text("guild_id").references(() => guilds.id, { onDelete: "cascade" }),
    channelId: text("channel_id"),
    success: boolean("success").default(true).notNull(),
    error: text("error"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    commandIdx: index("command_logs_command_idx").on(table.command),
    userIdx: index("command_logs_user_id_idx").on(table.userId),
    guildIdx: index("command_logs_guild_id_idx").on(table.guildId),
    createdIdx: index("command_logs_created_at_idx").on(table.createdAt),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    guildIdx: index("audit_logs_guild_id_idx").on(table.guildId),
    moderatorIdx: index("audit_logs_moderator_id_idx").on(table.moderatorId),
    targetIdx: index("audit_logs_target_id_idx").on(table.targetId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    createdIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  })
);

// ============================================
// Analytics Tables
// ============================================

export const dailyStats = pgTable(
  "daily_stats",
  {
    id: text("id").primaryKey(),
    date: date("date").unique().notNull(),
    commandsExecuted: integer("commands_executed").default(0).notNull(),
    commandsFailed: integer("commands_failed").default(0).notNull(),
    guildsActive: integer("guilds_active").default(0).notNull(),
    usersActive: integer("users_active").default(0).notNull(),
    messagesProcessed: integer("messages_processed").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    dateIdx: index("daily_stats_date_idx").on(table.date),
  })
);

// ============================================
// Relations (for Drizzle Relational Queries)
// ============================================

export const guildsRelations = relations(guilds, ({ many }) => ({
  members: many(guildMembers),
  warnings: many(warnings),
  bans: many(bans),
  kicks: many(kicks),
  notes: many(notes),
  reminders: many(reminders),
  auditLogs: many(auditLogs),
  commandLogs: many(commandLogs),
  customCommands: many(customCommands),
}));

export const usersRelations = relations(users, ({ many }) => ({
  guildMemberships: many(guildMembers),
  warnings: many(warnings),
  bans: many(bans),
  kicks: many(kicks),
  notes: many(notes),
  reminders: many(reminders),
}));

export const guildMembersRelations = relations(guildMembers, ({ one }) => ({
  user: one(users, { fields: [guildMembers.userId], references: [users.id] }),
  guild: one(guilds, { fields: [guildMembers.guildId], references: [guilds.id] }),
}));

export const warningsRelations = relations(warnings, ({ one }) => ({
  user: one(users, { fields: [warnings.userId], references: [users.id] }),
  guild: one(guilds, { fields: [warnings.guildId], references: [guilds.id] }),
}));

export const bansRelations = relations(bans, ({ one }) => ({
  user: one(users, { fields: [bans.userId], references: [users.id] }),
  guild: one(guilds, { fields: [bans.guildId], references: [guilds.id] }),
}));

export const kicksRelations = relations(kicks, ({ one }) => ({
  user: one(users, { fields: [kicks.userId], references: [users.id] }),
  guild: one(guilds, { fields: [kicks.guildId], references: [guilds.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
  guild: one(guilds, { fields: [notes.guildId], references: [guilds.id] }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.userId], references: [users.id] }),
  guild: one(guilds, { fields: [reminders.guildId], references: [guilds.id] }),
}));

export const customCommandsRelations = relations(customCommands, ({ one }) => ({
  guild: one(guilds, { fields: [customCommands.guildId], references: [guilds.id] }),
}));

export const commandLogsRelations = relations(commandLogs, ({ one }) => ({
  guild: one(guilds, { fields: [commandLogs.guildId], references: [guilds.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  guild: one(guilds, { fields: [auditLogs.guildId], references: [guilds.id] }),
}));

// ============================================
// Type exports
// ============================================

export type Guild = typeof guilds.$inferSelect;
export type NewGuild = typeof guilds.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type GuildMember = typeof guildMembers.$inferSelect;
export type NewGuildMember = typeof guildMembers.$inferInsert;

export type Warning = typeof warnings.$inferSelect;
export type NewWarning = typeof warnings.$inferInsert;

export type Ban = typeof bans.$inferSelect;
export type NewBan = typeof bans.$inferInsert;

export type Kick = typeof kicks.$inferSelect;
export type NewKick = typeof kicks.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;

export type CustomCommand = typeof customCommands.$inferSelect;
export type NewCustomCommand = typeof customCommands.$inferInsert;

export type CommandLog = typeof commandLogs.$inferSelect;
export type NewCommandLog = typeof commandLogs.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type DailyStats = typeof dailyStats.$inferSelect;
export type NewDailyStats = typeof dailyStats.$inferInsert;
