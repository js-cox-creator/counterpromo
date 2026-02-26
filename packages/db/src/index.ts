import { PrismaClient } from '../generated/client'

// ECS injects DB credentials as individual vars — construct DATABASE_URL if not already set
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  process.env.DATABASE_URL = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT ?? 5432}/${process.env.DB_NAME}`
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// Singleton — safe for both API and Worker
export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

export { PrismaClient }
