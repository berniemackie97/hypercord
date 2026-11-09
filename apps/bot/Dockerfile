FROM node:26.13.0-alpine AS base
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bot/package.json apps/bot/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps/bot apps/bot
COPY packages/shared packages/shared
RUN pnpm --filter @hypercord/bot build

FROM base AS production-dependencies
RUN pnpm install --frozen-lockfile --prod --filter @hypercord/bot

FROM node:26.13.0-alpine AS production
ENV NODE_ENV=production
WORKDIR /app/apps/bot
RUN apk add --no-cache dumb-init

COPY --from=production-dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/bot/node_modules /app/apps/bot/node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/bot/package.json /app/apps/bot/package.json
COPY --from=build --chown=node:node /app/apps/bot/dist /app/apps/bot/dist

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
