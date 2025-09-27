# Architecture

Monorepo (workspaces) with **apps/bot** and **packages/shared**.
- Bot: Discord gateway client (discord.js v14), slash command loader, REST command registrar, event bus, queue workers.
- Shared: domain types/utilities.
Infra: Postgres (Prisma), Redis (BullMQ), Docker, GitHub Actions, Prometheus-ready logging via pino.

Key principles:
- Typed config w/ Zod validation.
- Autoload commands/events by filename.
- Idempotent command registration (guild + global).
- Graceful shutdown, health & readiness endpoints (optional later).
