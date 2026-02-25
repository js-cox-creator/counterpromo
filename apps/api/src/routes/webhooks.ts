import type { FastifyInstance } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@counterpromo/db'
import { BillingPlan } from '@counterpromo/shared'
import { stripe, stripePriceToPlan } from '../lib/stripe.js'

/**
 * Verify a Clerk/Svix webhook signature without the svix package.
 *
 * Svix sends three headers:
 *   svix-id        — unique message id
 *   svix-timestamp — unix timestamp (seconds)
 *   svix-signature — space-separated "v1,<base64>" signatures
 *
 * Signed payload: `{svix-id}.{svix-timestamp}.{raw-body}`
 * The CLERK_WEBHOOK_SECRET has a "whsec_" prefix followed by a base64-encoded key.
 */
function verifyClerkWebhook(
  rawBody: Buffer,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): boolean {
  const base64Secret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = Buffer.from(base64Secret, 'base64')

  // Reject messages older than 5 minutes to prevent replay attacks
  const timestampMs = Number(svixTimestamp) * 1000
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`
  const expectedMac = createHmac('sha256', keyBytes).update(toSign).digest('base64')

  // The signature header contains space-separated "v1,<base64>" entries
  const signatures = svixSignature.split(' ')
  for (const sig of signatures) {
    const commaIdx = sig.indexOf(',')
    if (commaIdx === -1) continue
    const version = sig.slice(0, commaIdx)
    const provided = sig.slice(commaIdx + 1)
    if (version !== 'v1') continue
    try {
      const providedBuf = Buffer.from(provided, 'base64')
      const expectedBuf = Buffer.from(expectedMac, 'base64')
      if (providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf)) {
        return true
      }
    } catch {
      // ignore malformed entries
    }
  }
  return false
}

export async function webhookRoutes(app: FastifyInstance) {
  // POST /webhooks/stripe
  // Note: Stripe requires the raw body for signature verification.
  // @fastify/rawbody must be registered before this route (see server.ts).
  // The plugin exposes the raw body as request.rawBody.
  app.post(
    '/stripe',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

      const sig = request.headers['stripe-signature']
      if (!sig || typeof sig !== 'string') {
        return reply.status(400).send({ error: 'Missing stripe-signature header' })
      }

      // @fastify/rawbody stores the raw body as request.rawBody
      // Fall back to request.body cast to string if rawBody is not available
      const rawBody =
        (request as unknown as { rawBody?: string | Buffer }).rawBody ??
        (typeof request.body === 'string' ? request.body : JSON.stringify(request.body))

      let event
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
        return reply.status(400).send({ error: message })
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object
            const accountId = session.client_reference_id
            const stripeCustomerId =
              typeof session.customer === 'string' ? session.customer : session.customer?.id
            const stripeSubId =
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id

            if (!accountId) {
              app.log.warn({ sessionId: session.id }, 'checkout.session.completed missing client_reference_id')
              break
            }

            await prisma.account.update({
              where: { id: accountId },
              data: {
                ...(stripeCustomerId ? { stripeCustomerId } : {}),
                ...(stripeSubId ? { stripeSubId } : {}),
              },
            })
            break
          }

          case 'customer.subscription.updated': {
            const subscription = event.data.object
            const stripeCustomerId =
              typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer.id

            // Determine the plan from the first subscription item's price
            const priceId = subscription.items.data[0]?.price?.id
            const plan: BillingPlan = priceId ? stripePriceToPlan(priceId) : BillingPlan.Free

            await prisma.account.update({
              where: { stripeCustomerId },
              data: { plan },
            })
            break
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object
            const stripeCustomerId =
              typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer.id

            await prisma.account.update({
              where: { stripeCustomerId },
              data: {
                plan: BillingPlan.Free,
                stripeSubId: null,
              },
            })
            break
          }

          default:
            // Unhandled event type — ignore gracefully
            break
        }
      } catch (err) {
        app.log.error({ err, eventType: event.type }, 'Error processing Stripe webhook event')
        return reply.status(500).send({ error: 'Internal error processing webhook' })
      }

      return reply.send({ received: true })
    },
  )

  // POST /webhooks/clerk — Clerk user sync (no auth middleware, needs raw body)
  app.post(
    '/clerk',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      const secret = process.env.CLERK_WEBHOOK_SECRET
      if (!secret) {
        app.log.error('CLERK_WEBHOOK_SECRET is not configured')
        return reply.status(500).send({ error: 'Webhook secret not configured' })
      }

      const svixId = request.headers['svix-id']
      const svixTimestamp = request.headers['svix-timestamp']
      const svixSignature = request.headers['svix-signature']

      if (
        typeof svixId !== 'string' ||
        typeof svixTimestamp !== 'string' ||
        typeof svixSignature !== 'string'
      ) {
        return reply.status(400).send({ error: 'Missing svix headers' })
      }

      const rawBodySource = (request as unknown as { rawBody?: string | Buffer }).rawBody
      const rawBody: Buffer = Buffer.isBuffer(rawBodySource)
        ? rawBodySource
        : Buffer.from(
            typeof rawBodySource === 'string' ? rawBodySource : JSON.stringify(request.body),
          )

      const valid = verifyClerkWebhook(rawBody, svixId, svixTimestamp, svixSignature, secret)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid webhook signature' })
      }

      const event = request.body as {
        type: string
        data: {
          id?: string
        }
      }

      if (event.type === 'user.created') {
        // On user.created: if no AccountUser exists for this clerkId, do nothing.
        // Account creation is handled by POST /accounts on first login.
        app.log.info({ clerkId: event.data.id }, 'Clerk user.created — no action needed')
      } else if (event.type === 'user.deleted') {
        const clerkId = event.data.id
        if (clerkId) {
          const deleted = await prisma.accountUser.deleteMany({ where: { clerkId } })
          app.log.info(
            { clerkId, count: deleted.count },
            'Clerk user.deleted — removed AccountUser records',
          )
        }
      }

      return reply.send({ received: true })
    },
  )
}
