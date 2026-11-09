# Hypercord container deployment

The Compose stack runs PostgreSQL, Redis, a one-shot schema migration task, and the Discord bot. Only the bot can reach Discord. The database and Redis are not exposed on host ports in the default stack.

## Requirements

- Docker Engine with Compose v2
- A valid Discord bot token and application ID
- Unique PostgreSQL and Redis credentials
- Network access to Discord and any enabled AI provider

## Configuration

Copy `.env.example` to `.env` at the repository root. Replace **every** placeholder, including `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `BOT_TOKEN` and `CLIENT_ID`. The credentials embedded in `DATABASE_URL` and `REDIS_URL` must match the service passwords; URL-encode reserved characters in URL passwords. The hostnames `postgres` and `redis` resolve **inside** the Compose network.

Do not commit `.env` or place credentials in image build arguments. Docker environment variables and process arguments remain visible to users with container administration rights. Use an appropriate secret-management system and controlled Docker host access for production.

## Build and start

```bash
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 migrate bot
```

Compose waits for PostgreSQL and Redis container health and for the **migrate** task to finish successfully before starting the bot. Migrations use the checked-in Drizzle SQL files; they do not run as an image-build step or inside bot startup.

The migration container exits after applying migrations. Re-running `docker compose run --rm migrate` should not apply already-recorded migrations again. Take a verified database backup before deploying schema changes; migration execution is not a substitute for a rollback plan.

The bot image uses a repository-root build context, a frozen pnpm installation, a non-root runtime user, and runtime dependencies only. The bot process starts with `node dist/index.js`. No HTTP listener is currently implemented. No HTTP health endpoint or Docker bot healthcheck is advertised; operational readiness and shutdown guarantees remain open in Issues #14, #15 and #36. Use bot logs and the Discord gateway state to diagnose startup until those issues are completed.

## Local development

The development override exposes PostgreSQL and Redis only on the loopback interface and runs the bot through `tsx` with a read-only source mount:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The root `.env` still uses Compose hostnames. When running the bot directly on the host, instead use `apps/bot/.env.example` as a starting point for `apps/bot/.env`, with `localhost` addresses and matching database/Redis credentials.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm --filter @hypercord/bot test:coverage
```

CI checks the packaged command and event catalog, runs migrations twice against a disposable database, validates Compose and builds the production image. These checks do not substitute for an authenticated end-to-end Discord deployment or a database recovery exercise.

## Operational notes

- Run one bot replica until Discord sharding, worker ownership and idempotent job processing have been verified.
- Use `docker compose logs bot` and `docker compose logs migrate` to investigate failures; never print environment variables containing secrets.
- PostgreSQL data lives in `postgres_data` and Redis AOF data in `redis_data`. `docker compose down -v` **destroys** both volumes.
- Stop the stack with `docker compose down`; backup/restore, queue drain, and health monitoring remain separately tracked work.
