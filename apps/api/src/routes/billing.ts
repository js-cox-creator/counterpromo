import type { FastifyInstance } from 'fastify'
import { createClerkClient } from '@clerk/backend'
import { prisma } from '@counterpromo/db'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { stripe } from '../lib/stripe.js'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'

export async function billingRoutes(app: FastifyInstance) {
  // POST /billing/checkout — create Stripe checkout session
  // Restricted to owner or admin roles only
  app.post(
    '/checkout',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const { priceId } = request.body as { priceId: string }

      if (!priceId || typeof priceId !== 'string') {
        return reply.status(400).send({ error: 'priceId is required' })
      }

      const { accountId, clerkId } = request.auth

      // Fetch the account to check for an existing Stripe customer ID
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { id: true, name: true, stripeCustomerId: true },
      })

      if (!account) {
        return reply.status(404).send({ error: 'Account not found' })
      }

      let stripeCustomerId = account.stripeCustomerId

      // If no Stripe customer exists yet, create one
      if (!stripeCustomerId) {
        // Fetch the user's email from Clerk
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
        const clerkUser = await clerk.users.getUser(clerkId)
        const email =
          clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
            ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

        const customer = await stripe.customers.create({
          name: account.name,
          ...(email ? { email } : {}),
          metadata: { accountId },
        })

        stripeCustomerId = customer.id

        // Persist the new customer ID on the account
        await prisma.account.update({
          where: { id: accountId },
          data: { stripeCustomerId },
        })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/billing/success`,
        cancel_url: `${APP_URL}/billing/cancel`,
        client_reference_id: accountId,
        metadata: { accountId },
      })

      return reply.send({ url: session.url })
    },
  )

  // POST /billing/portal — create Stripe customer portal session
  app.post('/portal', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { stripeCustomerId: true },
    })

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' })
    }

    if (!account.stripeCustomerId) {
      return reply
        .status(400)
        .send({ error: 'No billing account found. Please subscribe to a plan first.' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${APP_URL}/dashboard`,
    })

    return reply.send({ url: session.url })
  })
}
