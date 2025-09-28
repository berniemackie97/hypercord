# Start Here — Hypercord Dev Manual

This is the fast, no-nonsense guide to running, developing, and shipping the Hypercord bot.

---

## Prerequisites

* **Node.js 20+** (LTS recommended)
* **pnpm** (Corepack-enabled; exact version pinned in the repo’s `packageManager`)
* **Docker runtime**: Docker Desktop / OrbStack / Colima (for Postgres + Redis)
* A Discord **BOT_TOKEN**, **CLIENT_ID**, and a dev **GUILD_ID** (for instant, guild-scoped commands)

> Ensure your Docker daemon is running before infra commands.

---

## One‑Command Dev Start (Recommended)

From the **repo root**:

```bash
pnpm install
cp apps/bot/.env.example apps/bot/.env  # fill BOT_TOKEN, CLIENT_ID, GUILD_ID, DATABASE_URL, REDIS_URL
pnpm run bot:up-all
```

What `bot:up-all` does:

1. `bot:up` → starts Docker Compose (Postgres + Redis)
2. `bot:db` → runs Prisma migrate + generate inside the bot package
3. `bot:dev:hot` → starts dev mode *and* auto‑registers slash commands on file changes

**Dev loop behavior**:

* The bot restarts automatically on code changes (`tsx watch`).
* When you add/edit files under `apps/bot/src/commands`, the register script runs automatically (via `chokidar`).
* New slash commands are available **instantly** in your dev guild (using `GUILD_ID`).

---

## Manual Dev Start (if you prefer explicit steps)

From the **repo root**:

```bash
pnpm install
cp apps/bot/.env.example apps/bot/.env
# 1) Infra up (Postgres + Redis)
pnpm run bot:up
# 2) DB migrate + generate (Prisma)
pnpm run bot:db
# 3) Register commands (guild if GUILD_ID set)
pnpm run bot:register
# 4) Run bot in watch mode
pnpm run bot:dev
```

> When you add a **new** command file, re-run `pnpm run bot:register`. Changes to an **existing** command are picked up by the watcher (the process restarts).

---

## Environment Variables (apps/bot/.env)

```
# Discord
BOT_TOKEN="..."
CLIENT_ID="..."
GUILD_ID="..."         # optional but recommended for fast dev registration

# Database / cache
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hypercord"
REDIS_URL="redis://localhost:6379"
```

If ports are busy, change them in `apps/bot/docker-compose.yaml` and mirror updates here.

---

## Adding a New Command

1. Create a file in `apps/bot/src/commands/` (e.g., `about.ts`).
2. Export a `data` (SlashCommandBuilder) and `execute` function.
3. **Dev:** If using `bot:dev:hot`, it auto‑registers. Otherwise run `pnpm run bot:register`.

Minimal template (TypeScript):

```ts
import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("About this bot.")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({ content: "Hypercord — modern Discord bot scaffold.", ephemeral: true });
}
```

**Guild vs Global:**

* With `GUILD_ID` set, registration is **guild‑scoped** and instant.
* Without it, registration is **global** (propagation can take up to ~1 hour).

---

## Queues & Reminders (BullMQ)

* The bot starts a BullMQ worker inside the process from `apps/bot/src/queue/index.ts`.
* `/remind when:<10m|2h|2025-10-01T20:00Z> what:<text>` schedules a delayed job in Redis and delivers in the channel (or DM fallback).
* Requires `REDIS_URL` and running Redis (via Compose or your runtime).

---

## Build & Run (Prod‑ish)

From the **repo root**:

```bash
pnpm run build           # builds the bot via tsup
pnpm -F @hypercord/bot run start   # runs dist/index.js via Node
```

You can also run under PM2 if you want a supervised process (optional).

---

## Tests, Lint, Format

From the **repo root**:

```bash
pnpm test            # vitest (apps/bot)
pnpm lint            # eslint
pnpm format          # prettier check
pnpm format:write    # prettier write
```

---

## Docker Controls (Infra Only)

```bash
pnpm run bot:up      # compose up -d (Postgres + Redis)
pnpm run bot:down    # compose down
```

> You rarely need to restart infra when editing commands; keep it running.

---

## Troubleshooting

* **Docker daemon not running**

  * Error: `Cannot connect to the Docker daemon ... docker.sock`
  * Fix: Start Docker Desktop / Colima / OrbStack, then retry `bot:up-all` or `bot:db`.

* **Ports 5432/6379 in use**

  * Edit `apps/bot/docker-compose.yaml` port mappings, update `.env` to match.

* **Slash command doesn’t appear**

  * Ensure `pnpm run bot:register` was run after adding the file (or use `bot:dev:hot`).
  * For global commands (no `GUILD_ID`), wait for Discord propagation.

* **TypeScript includes files outside rootDir**

  * Move `apps/bot/scripts/register-commands.ts` under `apps/bot/src/scripts/` and update the script to `tsx src/scripts/register-commands.ts`; or set `rootDir: "."` in the bot tsconfig.

* **Redis/DB health**

  * Use the `/diagnose` command (if added) to check WS/DB/Redis latencies.

---

## Script Reference (Root)

* `build` → `@hypercord/bot build`
* `dev` → `@hypercord/bot dev` (watch)
* `lint` / `test` / `format` / `format:write` → maps to bot package tasks
* `bot:up` / `bot:down` → Docker compose up/down for bot infra
* `bot:db` → Prisma migrate + generate (and ensures infra is up in bot script)
* `bot:register` → Register slash commands
* `bot:dev:hot` → Dev bot + auto‑register on command file changes
* `bot:up-all` → **One‑shot**: `bot:up` → `bot:db` → `bot:dev:hot`

## Script Reference (apps/bot)

* `dev` → `tsx watch src/index.ts`
* `build` → `tsup src/index.ts --dts --format esm --minify`
* `start` → `node dist/index.js`
* `register` → `tsx scripts/register-commands.ts`
* `watch:register` → watches `src/commands/**/*` and runs `register`
* `dev:hot` → runs `dev` + `watch:register` concurrently
* `db:dev` → `docker compose up -d` + `prisma migrate dev` + `prisma generate`
* `lint` / `test` / `format` / `format:write` → quality tools

---

## pnpm Workspace Tips

* Target a package by name:

  ```bash
  pnpm -F @hypercord/bot run <script>
  ```
* Or by path:

  ```bash
  pnpm --filter ./apps/bot run <script>
  ```
* List workspace packages (quick sanity check):

  ```bash
  pnpm -r list --depth -1
  ```

---

## FAQ

**Q: Do I need to restart the bot for new commands?**
**A:** With `bot:dev:hot`, *no*. New files auto‑register; code changes trigger a watcher restart. Without it, re‑run `bot:register` and restart your dev process once for new files.

**Q: Do I need to restart Postgres/Redis when editing code?**
**A:** No. Keep infra running and iterate on the bot.

**Q: Guild vs Global commands?**
**A:** Dev with guild‑scoped commands (instant), promote to global once stable.
