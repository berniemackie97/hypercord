# Hypercord Bot - Architecture Documentation

See the comprehensive onboarding guide and system documentation in the `docs/` folder for full details.

## Quick Architecture Overview

### System Components

1. **Discord.js Client** (`src/core/client.ts`) - Main bot client
2. **Database Layer** (`src/db/`) - Drizzle ORM with PostgreSQL (12 tables)
3. **Queue System** (`src/queue/`) - BullMQ with Redis (reminders, daily stats)
4. **Command System** (`src/commands/`) - CommandBuilder with middleware pipeline
5. **Event System** (`src/events/`) - Discord gateway event handlers
6. **Audit System** (`src/core/audit.ts`) - Complete action tracking

### Data Flow

```
User → Discord → Event Handler → Middleware → Command → Database + Audit
```

### Key Features

- **Auto-tracking**: Users, guilds, and members synced automatically
- **Command logging**: Every command execution tracked
- **Audit logging**: All moderation actions logged
- **Rate limiting**: Per-user, per-guild, per-channel
- **Validation**: Zod schemas for type-safe input
- **Background jobs**: Scheduled reminders and daily stats
- **Per-guild config**: Customizable settings per server

### Database Tables (12 total)

1. users - All Discord users
2. guilds - All servers
3. guildMembers - User membership
4. commandLogs - Command execution history
5. bans - Ban records
6. kicks - Kick records
7. warnings - User warnings
8. reminders - Scheduled reminders
9. notes - Moderator notes
10. customCommands - Guild commands
11. auditLogs - Audit trail
12. dailyStats - Daily aggregated stats

For complete documentation, see `docs/ONBOARDING.md`.
