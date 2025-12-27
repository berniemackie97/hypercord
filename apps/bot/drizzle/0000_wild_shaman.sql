CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"reason" text NOT NULL,
	"banned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"unbanned_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"command" text NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text,
	"channel_id" text,
	"success" boolean DEFAULT true NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"response" text NOT NULL,
	"creator_id" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_commands_guild_id_name_key" UNIQUE("guild_id","name")
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"commands_executed" integer DEFAULT 0 NOT NULL,
	"commands_failed" integer DEFAULT 0 NOT NULL,
	"guilds_active" integer DEFAULT 0 NOT NULL,
	"users_active" integer DEFAULT 0 NOT NULL,
	"messages_processed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_stats_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "guild_members" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"nickname" text,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "guild_members_user_id_guild_id_key" UNIQUE("user_id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kicks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"reason" text NOT NULL,
	"kicked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"content" text NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"is_completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"global_name" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warnings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"guild_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_logs" ADD CONSTRAINT "command_logs_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_commands" ADD CONSTRAINT "custom_commands_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kicks" ADD CONSTRAINT "kicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kicks" ADD CONSTRAINT "kicks_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_guild_id_idx" ON "audit_logs" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "audit_logs_moderator_id_idx" ON "audit_logs" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_id_idx" ON "audit_logs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bans_user_id_idx" ON "bans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bans_guild_id_idx" ON "bans" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "bans_moderator_id_idx" ON "bans" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "bans_is_active_idx" ON "bans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "bans_expires_at_idx" ON "bans" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "command_logs_command_idx" ON "command_logs" USING btree ("command");--> statement-breakpoint
CREATE INDEX "command_logs_user_id_idx" ON "command_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "command_logs_guild_id_idx" ON "command_logs" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "command_logs_created_at_idx" ON "command_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "custom_commands_guild_id_idx" ON "custom_commands" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "custom_commands_is_enabled_idx" ON "custom_commands" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "daily_stats_date_idx" ON "daily_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "guild_members_user_id_idx" ON "guild_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "guild_members_guild_id_idx" ON "guild_members" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "guild_members_is_active_idx" ON "guild_members" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "guilds_owner_id_idx" ON "guilds" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "guilds_is_active_idx" ON "guilds" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "kicks_user_id_idx" ON "kicks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kicks_guild_id_idx" ON "kicks" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "kicks_moderator_id_idx" ON "kicks" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_guild_id_idx" ON "notes" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "notes_moderator_id_idx" ON "notes" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "reminders_user_id_idx" ON "reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminders_guild_id_idx" ON "reminders" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "reminders_scheduled_for_idx" ON "reminders" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "reminders_is_completed_idx" ON "reminders" USING btree ("is_completed");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "warnings_user_id_idx" ON "warnings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "warnings_guild_id_idx" ON "warnings" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "warnings_moderator_id_idx" ON "warnings" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "warnings_is_active_idx" ON "warnings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "warnings_expires_at_idx" ON "warnings" USING btree ("expires_at");