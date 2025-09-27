FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-*.yaml* package-lock.json* ./
COPY ../../package.json ../../pnpm-*.yaml* ../../package-lock.json* /tmp/monorepo/
RUN corepack enable && if [ -f /tmp/monorepo/pnpm-workspace.yaml ]; then npm i -g pnpm && pnpm -v && pnpm install --frozen-lockfile; else npm ci; fi
COPY . .
RUN npx tsup src/index.ts --dts --format esm --minify
CMD ["node","dist/index.js"]
