# Operations

## Dev
1) Copy env: cp apps/bot/.env.example apps/bot/.env and fill BOT_TOKEN, CLIENT_ID, GUILD_ID (for fast guild registrations).
2) pnpm install
3) pnpm -w apps/bot run db:dev   # start docker-compose (pg+redis) & prisma migrate
4) pnpm -w apps/bot run register # registers slash cmds (guild if GUILD_ID set)
5) pnpm -w apps/bot run dev

## Build
pnpm -w apps/bot run build

## Docker
docker compose -f apps/bot/docker-compose.yaml up -d
