# Hypercord - Enterprise Discord Bot Framework 🚀

**The most advanced, feature-rich Discord bot you can self-host.**

[![CI](https://github.com/berniemackie97/hypercord/actions/workflows/ci.yml/badge.svg)](https://github.com/berniemackie97/hypercord/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](./)
[![Discord.js](https://img.shields.io/badge/discord.js-14.22-5865F2)](./)

## What Makes Hypercord REVOLUTIONARY?

### 🤖 **World's First Multi-Provider AI Discord Bot**
- **4 AI Providers**: OpenAI GPT, Anthropic Claude, Google Gemini, Grok
- **FREE Unlimited AI**: Gemini 1.5 Flash at no cost
- **Per-Channel Configuration**: Different AI models for different purposes
- **Enterprise Quota System**: Monthly limits, usage tracking, cost analytics
- **User-Level Grants**: Reward members with premium AI access

### 💎 **Enterprise-Grade Features**
- **25 Database Tables**: Complete data model with Drizzle ORM
- **36 command modules**: Moderation, economy, leveling, casino, AI, and more
- **passing automated tests**: coverage tracked with a measured CI regression floor below the 80% objective
- **Multi-tier AI Access**: Guild > Channel > User priority system
- **Real-time Cost Tracking**: Know exactly what you're spending

### 🎯 **Feature Comparison**

| Feature | MEE6 | Dyno | Carl-bot | **Hypercord** |
|---------|------|------|----------|--------------|
| **AI Assistant** | ❌ | ❌ | ❌ | **✅ 4 PROVIDERS** |
| **FREE AI** | ❌ | ❌ | ❌ | **✅ UNLIMITED** |
| **Per-Channel AI** | ❌ | ❌ | ❌ | **✅ CUSTOM MODELS** |
| Economy System | ✅ Premium | ❌ | ❌ | ✅ FREE |
| Leveling | ✅ Premium | ✅ | ❌ | ✅ FREE |
| Casino/Gambling | ❌ | ❌ | ❌ | ✅ FREE |
| Role Shop | ❌ | ❌ | ❌ | ✅ UNIQUE |
| Message Snipe | ❌ | ❌ | ❌ | ✅ UNIQUE |
| Source Code | ❌ | ❌ | ❌ | ✅ YOURS |

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Discord Bot Token
- (Optional) AI API Keys

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/hypercord.git
cd hypercord

# Install dependencies
pnpm install

# Set up environment
cp apps/bot/.env.example apps/bot/.env
# Edit .env with your credentials

# Run versioned database migrations
pnpm --filter @hypercord/bot db:migrate

# Start the bot
pnpm dev
```

Message-based XP, spam scanning and content caching require explicit `MESSAGE_CONTENT_ENABLED=true` and authorized Message Content intent access. See [Docker deployment and Discord Gateway permissions](DOCKER.md).

### Docker Setup (Recommended)

```bash
# Configure credentials using .env.example before running
cp .env.example .env
# Edit passwords, URLs, token and application ID

docker compose up --build -d

# View logs
docker compose logs -f bot

# Stop services
docker compose down
```

## AI Setup (Optional but Recommended)

To configure an optional AI provider:

1. Visit https://ai.google.dev
2. Get API key (FREE, no credit card required)
3. Add the provider's API key to your environment
4. In Discord: `/ai-config set-default gemini gemini-1.5-flash`
5. Mention the bot: `@BotName explain TypeScript`

**For premium AI:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Grok: https://console.x.ai

## Core Features

### 🔨 Moderation
- `/ban` `/kick` `/warn` `/timeout` - Standard moderation
- `/purge` - Bulk message deletion
- Auto-mod spam detection with auto-timeout
- Complete audit trail with metadata

### 💰 Economy System
- `/balance` `/daily` `/work` `/pay` - Earn and manage currency
- `/shop` - Buy roles with earned currency
- `/coinflip` `/blackjack` - Casino games with real betting
- Transaction logging and leaderboards

### 📈 Leveling System
- Automatic XP from messages (1 XP per minute)
- `/level` `/leaderboard` `/setlevel` - Level management
- Role rewards for reaching levels
- Customizable XP rates

### 🤖 AI Assistant (REVOLUTIONARY)
```bash
# Admin: Configure AI per channel
/ai-config set-channel #code-help anthropic claude-3-5-sonnet "Expert code reviewer"
/ai-config set-channel #general gemini gemini-1.5-flash "Friendly assistant"

# Admin: Grant premium AI to users
/ai-grant @user anthropic claude-3-5-sonnet monthly-limit:50 expires-days:30

# Users: Check quota
/ai-quota

# Admins: View analytics
/ai-stats
```

**AI Use Cases:**
- **#general**: Free Gemini for casual chat
- **#code-help**: Claude Sonnet for code reviews
- **#homework**: GPT-4o-mini with "don't give direct answers" prompt
- **Premium members**: Unlimited Claude access as a perk

### 🎉 Engagement Features
- `/giveaway` - Multi-winner giveaways with auto-selection
- `/afk` - AFK status with auto-removal
- `/snipe` - View deleted messages
- `/editsnipe` - View message edits

### 🛠️ Utility
- `/ping` `/diagnose` `/userinfo` `/stats`
- `/remind` - Schedule reminders
- `/config` - Guild configuration
- `/audit-perms` - Security audit

## Architecture

```
hypercord/
├── apps/bot/               # Main bot application
│   ├── src/
│   │   ├── commands/       # Slash commands (43+)
│   │   ├── events/         # Discord event handlers (11)
│   │   ├── core/           # Core systems (config, logger, middleware)
│   │   ├── services/       # AI service, economy, etc.
│   │   ├── db/             # Database schema & migrations
│   │   ├── queue/          # Background jobs (BullMQ)
│   │   └── utils/          # Utilities and helpers
│   └── __tests__/          # Test suite (automated tests)
├── docker-compose.yml      # Production stack
├── FEATURES.md             # Complete feature list
└── README.md               # This file
```

### Tech Stack
- **Framework**: Discord.js v14
- **Language**: TypeScript 5.9 (strict mode)
- **Database**: PostgreSQL + Drizzle ORM
- **Cache/Queue**: Redis + BullMQ
- **AI**: OpenAI, Anthropic, Google AI SDKs
- **Testing**: Vitest (passing automated tests; coverage objective not yet met)
- **Build**: tsup (ESM, minified)

## Database Schema

**25 Tables:**
- **Core**: users, guilds, guildMembers, commandLogs
- **Moderation**: bans, kicks, warnings, notes, auditLogs
- **Economy**: economy, transactions, shopItems, inventory
- **Leveling**: levels, levelRewards
- **Engagement**: giveaways, afkStatus, messageCache
- **AI**: aiChannelConfig, aiUserAccess, aiUsageLog, aiQuotas
- **Analytics**: dailyStats, reminders

## Development

### Commands
```bash
# Development
pnpm dev          # Start with hot reload
pnpm typecheck    # Typecheck bot, shared package, scripts and tests
pnpm build        # Production build
pnpm test         # Run tests
pnpm test:watch   # Watch mode
pnpm lint         # ESLint check
pnpm format       # Prettier format

# Database
pnpm --filter @hypercord/bot db:migrate  # Apply committed migrations
pnpm db:studio    # Open Drizzle Studio
pnpm db:generate  # Generate migrations
```

### Adding a New Command

```typescript
// apps/bot/src/commands/example.ts
import { SlashCommandBuilder } from "discord.js";
import { createCommand } from "../core/commandBuilder.js";
import { loggingMiddleware, guildOnlyMiddleware } from "../core/middleware.js";

const commandData = new SlashCommandBuilder()
  .setName("example")
  .setDescription("Example command");

export const { data, execute } = createCommand(commandData)
  .use(loggingMiddleware())
  .use(guildOnlyMiddleware())
  .setHandler(async (interaction) => {
    await interaction.reply("Hello world!");
  })
  .build();
```

## Configuration

### Environment Variables

```env
# Required
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_application_id
DATABASE_URL=postgresql://user:pass@localhost:5432/hypercord
REDIS_URL=redis://localhost:6379

# Optional - AI Providers
GEMINI_API_KEY=           # FREE unlimited
OPENAI_API_KEY=           # OpenAI GPT
ANTHROPIC_API_KEY=        # Claude
GROK_API_KEY=             # Grok

# Optional - Admin access
ADMIN_USER_IDS=user1,user2
ADMIN_ROLE_IDS=role1,role2
```

### Guild Configuration

```bash
/config set-modlog #mod-logs        # Moderation log channel
/config set-welcome #welcome        # Welcome messages
/config set-leave #farewells        # Leave messages
/config set-autorole @Member        # Auto-assigned role
```

## Production Deployment

### Docker (Recommended)

```bash
# Review DOCKER.md and provide secrets before deployment
docker compose up --build -d

# View logs
docker compose logs -f

# Multiple bot replicas are not supported until sharding and job ownership are verified
```

### Manual Deployment

```bash
# Build
pnpm build

# Start with PM2
pm2 start dist/index.js --name hypercord

# Or with systemd
sudo systemctl enable hypercord
sudo systemctl start hypercord
```

## Cost Analysis (AI)

**Typical Server (5,000 AI messages/month):**
- Gemini Flash: **$0** (FREE)
- GPT-4o Mini: ~$0.10
- Claude Haiku: ~$0.40
- Claude Sonnet: ~$2.00
- GPT-4o: ~$12.50

**Recommended Setup:**
- Default: Gemini Flash (FREE)
- #code-help: Claude Sonnet ($2/mo for 1k msgs)
- Premium users: GPT-4o Mini (cheap, good quality)

## Statistics

- **25 database tables** (most comprehensive Discord bot)
- **36 command modules** in the source catalog
- **automated tests** passing in the verified CI baseline
- **9 event modules** in the source catalog
- **4 AI providers** (unprecedented flexibility)
- **Production bundle** verified against the command and event catalog
- **3 background queues** (async processing)

## Why Self-Host?

**vs MEE6 Premium ($11.95/month):**
- ❌ Limited features behind paywall
- ❌ No source code access
- ❌ No database access
- ❌ Shared infrastructure
- ❌ No AI assistant
- **Hypercord: $0-5/month + FREE AI**

**vs Building from Scratch:**
- ✅ Save 100+ hours of development
- ✅ Battle-tested architecture
- Test coverage remains below the target; see issue #9
- Deployment and lifecycle verification remains open; see issues #12–#15
- ✅ Extensive documentation

## Contributing

See [TESTING.md](./apps/bot/TESTING.md) for development guidelines.

## License

License declaration is pending; no LICENSE file is currently committed.

## Support

- Issues: https://github.com/yourusername/hypercord/issues
- Docs: [FEATURES.md](./FEATURES.md)
- Tests: [TESTING.md](./apps/bot/TESTING.md)

---

**Built with ❤️ using TypeScript, Discord.js, and cutting-edge AI technology.**

**NO OTHER DISCORD BOT HAS MULTI-PROVIDER AI WITH QUOTA MANAGEMENT!** 🚀
