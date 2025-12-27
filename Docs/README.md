# Hypercord Bot - Documentation

Welcome to the comprehensive internal documentation for Hypercord Discord Bot.

## Documentation Index

### Getting Started
- [Quick Start Guide](../apps/bot/README.md) - Get up and running quickly
- [Architecture Overview](./ARCHITECTURE.md) - System design and architecture
- [Development Setup](./DEVELOPMENT.md) - Setting up your dev environment

### Core Systems
- [Database System](./DATABASE.md) - Schema, migrations, and ORM usage
- [Command System](./COMMANDS.md) - Building and registering commands
- [Event System](./EVENTS.md) - Handling Discord gateway events
- [Queue System](./QUEUES.md) - Background jobs with BullMQ
- [Middleware](./MIDDLEWARE.md) - Request pipeline and middleware

### Features
- [Moderation](./MODERATION.md) - Moderation commands and workflows
- [Configuration](./CONFIGURATION.md) - Per-guild settings
- [Audit Logging](./AUDIT.md) - Tracking all actions
- [Auto-Tracking](./AUTO_TRACKING.md) - User and guild sync

### Operations
- [Deployment](./DEPLOYMENT.md) - Production deployment guide
- [Docker](../DOCKER.md) - Docker and compose setup
- [Testing](./TESTING.md) - Testing guide and best practices
- [Monitoring](./MONITORING.md) - Health checks and metrics

## Quick Reference

### Project Structure
\`\`\`
hypercord/
├── apps/bot/                 # Main bot application
│   ├── src/
│   │   ├── commands/         # Slash commands
│   │   ├── events/           # Discord event handlers
│   │   ├── core/             # Core systems (client, config, logger, etc.)
│   │   ├── db/               # Database layer (Drizzle ORM)
│   │   ├── queue/            # Background job queues (BullMQ)
│   │   ├── lib/              # Utilities (loader, etc.)
│   │   └── utils/            # Helper functions
│   ├── drizzle/              # Database migrations
│   ├── scripts/              # Utility scripts
│   └── tests/                # Test files
├── docs/                     # This documentation
└── packages/                 # Shared packages (future)
\`\`\`

### Tech Stack
- **Runtime**: Node.js 22+
- **Language**: TypeScript (ESM)
- **Database**: PostgreSQL 16 + Drizzle ORM
- **Cache/Queue**: Redis 7 + BullMQ
- **Discord**: discord.js v14
- **Testing**: Vitest
- **Build**: tsup

### Environment Variables
\`\`\`env
BOT_TOKEN=          # Discord bot token
CLIENT_ID=          # Discord application ID
DATABASE_URL=       # PostgreSQL connection string
REDIS_URL=          # Redis connection string
GUILD_ID=           # Dev guild (optional)
LOG_LEVEL=          # Log level (optional, default: info)
\`\`\`

### Common Commands
\`\`\`bash
# Development
pnpm dev                    # Start with hot reload
pnpm build                  # Build for production
pnpm test                   # Run tests
pnpm test:coverage          # Run tests with coverage

# Database
pnpm db:generate            # Generate migration from schema
pnpm db:migrate             # Apply migrations
pnpm db:push                # Push schema changes (dev)
pnpm db:studio              # Open Drizzle Studio

# Commands
pnpm register               # Register slash commands with Discord
\`\`\`

## Contributing

See each subsystem's documentation for detailed contribution guidelines.

## Support

For questions or issues, refer to the specific documentation section or check the main README.
