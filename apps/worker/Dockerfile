FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# Build
FROM deps AS builder
COPY . .
RUN npm run build --workspace=packages/shared
RUN npm run db:generate --workspace=packages/db
RUN npm run build --workspace=packages/db
RUN npm run build --workspace=apps/worker

# Runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/generated ./packages/db/generated
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/packages/db/generated/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

CMD ["node", "apps/worker/dist/index.js"]
