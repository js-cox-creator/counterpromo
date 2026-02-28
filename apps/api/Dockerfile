FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

# Build
FROM deps AS builder
COPY . .
RUN npm run build --workspace=packages/shared
RUN npm run db:generate --workspace=packages/db
RUN npm run build --workspace=packages/db
RUN npm run build --workspace=apps/api

# Runtime
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/generated ./packages/db/generated
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Bypass Prisma's OpenSSL auto-detection on Alpine — point directly to the correct engine binary
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/packages/db/generated/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

EXPOSE 3001
CMD ["sh", "-c", \
  "export DATABASE_URL=\"postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}\" && \
   npx prisma migrate deploy --schema packages/db/prisma/schema.prisma && \
   node apps/api/dist/server.js"]
