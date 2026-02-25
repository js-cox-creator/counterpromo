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

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
})

await app.register(helmet)
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
})

// Raw body capture — must be registered before webhook routes so Stripe
// signature verification has access to the unmodified request body.
await app.register(import('fastify-raw-body'), { field: 'rawBody', global: false, runFirst: true })

// Health check (no auth)
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// Stripe webhooks — raw body required, no auth middleware
await app.register(webhookRoutes, { prefix: '/webhooks' })

// App routes
await app.register(accountRoutes, { prefix: '/accounts' })
await app.register(brandKitRoutes, { prefix: '/brand-kit' })
await app.register(promoRoutes, { prefix: '/promos' })
await app.register(jobRoutes, { prefix: '/jobs' })
await app.register(billingRoutes, { prefix: '/billing' })
await app.register(usageRoutes, { prefix: '/usage' })
await app.register(userRoutes, { prefix: '/users' })

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`API running on http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
