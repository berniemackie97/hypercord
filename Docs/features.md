# Features

## Implemented
- TS bot skeleton (discord.js v14) with intents for Guilds & Interactions
- Slash command framework (auto-discovery)
- REST registrar script (guild/global)
- Structured logging (pino)
- Env config with Zod schema validation
- Linting (eslint + @typescript-eslint), formatting (prettier)
- Testing (vitest)
- Prisma + Postgres schema stub
- BullMQ + Redis wiring stub
- Dockerfile + docker-compose (db, redis)
- GitHub Actions CI (lint, build, test)

## Planned
- Command cooldowns, permissions
- Sharding via @discordjs/ws or official sharder
- Web dashboard (read-only) & health endpoints
- Metrics (Prometheus) and alerting
- Rate-limit aware job workers and backoff
- Command usage analytics & per-guild config
