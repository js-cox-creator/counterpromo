import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { accountRoutes } from './routes/accounts.js'
import { brandKitRoutes } from './routes/brand-kit.js'
import { promoRoutes } from './routes/promos.js'
import { jobRoutes } from './routes/jobs.js'
import { billingRoutes } from './routes/billing.js'
import { usageRoutes } from './routes/usage.js'
import { webhookRoutes } from './routes/webhooks.js'
import { userRoutes } from './routes/users.js'
import { branchRoutes } from './routes/branches.js'
import { importMappingRoutes } from './routes/import-mappings.js'
import { coopRoutes } from './routes/coop.js'
import { templateRoutes } from './routes/templates.js'
import { folderRoutes } from './routes/folders.js'
import { snippetRoutes } from './routes/snippets.js'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
})

await app.register(helmet)
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Raw body capture — must be registered before webhook routes so Stripe
// signature verification has access to the unmodified request body.
await app.register(import('fastify-raw-body'), { field: 'rawBody', global: false, runFirst: true })

// Health check (no auth) — always at root; also at /api/health when behind ALB
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))
if (process.env.API_PREFIX) {
  app.get(`${process.env.API_PREFIX}/health`, async () => ({ status: 'ok', ts: new Date().toISOString() }))
}

// Stripe webhooks — raw body required, no auth middleware
await app.register(webhookRoutes, { prefix: '/webhooks' })

// App routes — prefix with /api when behind ALB (set API_PREFIX=/api in ECS)
const p = process.env.API_PREFIX ?? ''
await app.register(accountRoutes, { prefix: `${p}/accounts` })
await app.register(brandKitRoutes, { prefix: `${p}/brand-kit` })
await app.register(promoRoutes, { prefix: `${p}/promos` })
await app.register(jobRoutes, { prefix: `${p}/jobs` })
await app.register(billingRoutes, { prefix: `${p}/billing` })
await app.register(usageRoutes, { prefix: `${p}/usage` })
await app.register(userRoutes, { prefix: `${p}/users` })
await app.register(branchRoutes, { prefix: `${p}/branches` })
await app.register(importMappingRoutes, { prefix: `${p}/import-mappings` })
await app.register(coopRoutes, { prefix: `${p}/coop` })
await app.register(templateRoutes, { prefix: `${p}/templates` })
await app.register(folderRoutes, { prefix: `${p}/folders` })
await app.register(snippetRoutes, { prefix: `${p}/snippets` })

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`API running on http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
