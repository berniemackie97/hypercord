# Hypercord Bot

A hyper-advanced, enterprise-grade Discord bot framework built with TypeScript, featuring comprehensive middleware, testing, monitoring, and clean architecture.

## Features

### ✨ Core Features
- **Modular Command System** - Auto-discovery of commands with dynamic loading
- **Event-Driven Architecture** - Clean separation of concerns
- **TypeScript First** - Full type safety with strict mode
- **ESM Modules** - Modern ES2022 module system
- **Monorepo Structure** - Scalable workspace architecture

### 🛡️ Enterprise Features
- **Middleware System** - Command-level middleware with chaining
- **Rate Limiting** - Built-in rate limiting and cooldowns
- **Permission Management** - Flexible permission checking
- **Graceful Shutdown** - Proper cleanup on termination
- **Health Checks** - Monitor Discord, database, and Redis connections
- **Metrics** - Track command execution, memory, CPU usage
- **Error Handling** - Comprehensive error recovery
- **Validation** - Zod-based command argument validation

### 🧪 Testing & Quality
- **Vitest** - Fast unit and integration testing
- **Code Coverage** - 80%+ coverage threshold
- **CI/CD** - Automated testing and deployment
- **Linting** - ESLint with TypeScript support
- **Formatting** - Prettier for consistent code style

### 📦 Infrastructure
- **PostgreSQL** - Drizzle ORM for database
- **Redis** - BullMQ for job queues
- **Docker** - Containerized deployment
- **Structured Logging** - Pino logger with JSON output

## Quick Start

### Prerequisites
- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- npm (or pnpm)

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start infrastructure
docker compose up -d

# Run database migrations
npm run db:migrate

# Register commands
npm run register

# Start development server
npm run dev
```

## Project Structure

```
apps/bot/
├── src/
│   ├── commands/          # Slash commands
│   │   ├── ping.ts
│   │   ├── remind.ts
│   │   ├── audit-perms.ts
│   │   ├── diagnose.ts
│   │   └── example-enhanced.ts  # Example with middleware
│   ├── core/              # Core systems
│   │   ├── client.ts      # Discord client setup
│   │   ├── config.ts      # Environment configuration
│   │   ├── logger.ts      # Pino logger
│   │   ├── middleware.ts  # Middleware system
│   │   ├── rateLimiter.ts # Rate limiting
│   │   ├── commandBuilder.ts  # Command builder with middleware
│   │   ├── validation.ts  # Zod validation
│   │   ├── health.ts      # Health checks & metrics
│   │   └── shutdown.ts    # Graceful shutdown
│   ├── events/            # Event handlers
│   │   ├── ready.ts
│   │   └── interactionCreate.ts
│   ├── lib/               # Utilities
│   │   └── loader.ts      # Dynamic module loader
│   ├── queue/             # Background jobs
│   │   └── index.ts       # BullMQ workers
│   ├── utils/             # Helper functions
│   │   └── dateParser.ts  # Duration parsing
│   └── index.ts           # Entry point
├── drizzle/
│   └── migrations/        # Database migrations
├── src/db/
│   ├── schema.ts          # Database schema
│   └── index.ts           # Database client
├── scripts/
│   └── register-commands.ts  # Command registration
├── Dockerfile
├── docker-compose.yaml
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

## Usage

### Creating a Simple Command

```typescript
import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("Say hello");

export async function execute(interaction) {
  await interaction.reply("Hello, world!");
}
```

### Creating an Enhanced Command with Middleware

```typescript
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, permissionMiddleware } from "../core/middleware.js";
import { rateLimitMiddleware } from "../core/rateLimiter.js";
import { validationMiddleware, schemas } from "../core/validation.js";
import { z } from "zod";

const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user")
  .addUserOption(opt =>
    opt.setName("user").setDescription("User to ban").setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName("reason").setDescription("Ban reason").setRequired(false)
  );

const optionsSchema = z.object({
  user: schemas.snowflake,
  reason: z.string().max(512).optional(),
});

export const { data: commandData, execute } = createCommand(data)
  .use(loggingMiddleware())
  .use(permissionMiddleware([PermissionFlagsBits.BanMembers]))
  .use(rateLimitMiddleware({ max: 5, window: 60000 }))
  .use(validationMiddleware(optionsSchema))
  .setHandler(async (interaction) => {
    const { user, reason } = getValidatedOptions(interaction);
    // Ban logic here
    await interaction.reply(`✅ Banned user ${user}`);
  })
  .build();
```

### Available Middleware

```typescript
import {
  loggingMiddleware,        // Log command execution
  permissionMiddleware,     // Check Discord permissions
  guildOnlyMiddleware,      // Require server context
  ownerOnlyMiddleware,      // Restrict to bot owners
  deferMiddleware,          // Defer reply for long commands
  errorHandlerMiddleware,   // Handle errors gracefully
} from "../core/middleware.js";

import {
  rateLimitMiddleware,      // Rate limiting
  cooldownMiddleware,       // Simple cooldowns
} from "../core/rateLimiter.js";

import {
  validationMiddleware,     // Zod validation
  schemas,                  // Common schemas
} from "../core/validation.js";
```

### Health Checks

```typescript
import { healthManager } from "../core/health.js";
import { db } from "../db/index.js";
import Redis from "ioredis";
import postgres from "postgres";

const queryClient = postgres(process.env.DATABASE_URL);
const redis = new Redis();

// Get health status
const health = await healthManager.getHealth(queryClient, redis);

// Get metrics
const metrics = healthManager.getMetrics();

// Log health
await healthManager.logHealth(queryClient, redis);
```

## Scripts

```bash
# Development
npm run dev              # Start with tsx watch
npm run dev:hot          # Start with auto command registration

# Building
npm run build            # Build with tsup

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
npm run test:ui          # Interactive UI

# Linting & Formatting
npm run lint             # Check lint
npm run format           # Check formatting
npm run format:write     # Fix formatting

# Database
npm run db:dev           # Start DB and run migrations

# Commands
npm run register         # Register slash commands
```

## Environment Variables

```env
# Required
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_application_id
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379

# Optional
GUILD_ID=dev_server_id_for_faster_registration
LOG_LEVEL=info
ADMIN_USER_IDS=123456789,987654321
ADMIN_ROLE_IDS=111111111,222222222
```

## Docker Deployment

```bash
# Build image
docker build -t hypercord-bot .

# Run with docker-compose
docker compose up -d

# View logs
docker compose logs -f bot

# Stop
docker compose down
```

## CI/CD

The project includes a comprehensive CI/CD pipeline:

- ✅ Linting with ESLint
- ✅ Type checking with TypeScript
- ✅ Unit & integration tests
- ✅ Code coverage reporting
- ✅ Automatic PR comments with coverage diff
- ✅ PostgreSQL & Redis test services

## Testing

See [TESTING.md](./TESTING.md) for detailed testing documentation.

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Architecture

### Command Flow

```
User Input
  ↓
Discord API
  ↓
interactionCreate Event
  ↓
Command Loader (finds command)
  ↓
Middleware Chain
  ├─ Error Handler
  ├─ Logging
  ├─ Permissions
  ├─ Rate Limiting
  ├─ Validation
  └─ Custom Middleware
  ↓
Command Handler
  ↓
Response to User
```

### Graceful Shutdown

```
SIGTERM/SIGINT
  ↓
Shutdown Manager
  ├─ Destroy Discord Client
  ├─ Clean up Rate Limiter
  ├─ Stop Background Workers
  ├─ Close Database Connections
  └─ Custom Handlers
  ↓
Exit Process
```

## Best Practices

1. **Always use middleware** for cross-cutting concerns
2. **Validate inputs** with Zod schemas
3. **Add rate limits** to prevent abuse
4. **Handle errors gracefully** with try-catch
5. **Log important events** for debugging
6. **Write tests** for new commands
7. **Use TypeScript types** for safety
8. **Document complex logic**

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure lint and tests pass
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
