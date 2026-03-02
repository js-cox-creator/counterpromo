import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { createClerkClient } from '@clerk/backend'
import { requireAuth, requireJwtAuth } from '../middleware/auth.js'

const CreateAccountBody = z.object({
  name: z.string().min(1).max(255),
})

const accountSelect = {
  id: true,
  name: true,
  plan: true,
  onboardingCompleted: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function accountRoutes(app: FastifyInstance) {
  // GET /accounts/me — return account + plan + current user role
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId, clerkId, role } = request.auth

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        plan: true,
        onboardingCompleted: true,
        stripeCustomerId: true,
        stripeSubId: true,
        isProductAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' })
    }

    return reply.send({
      ...account,
      currentUser: {
        clerkId,
        role,
        isProductAdmin: account.isProductAdmin,
      },
    })
  })

  // POST /accounts/bootstrap — first-login handler.
  // Uses JWT-only auth (no AccountUser required). Idempotent: returns existing
  // account if one already exists for this clerkId.
  // Body: { accountName?: string, onboardingCompleted?: boolean }
  app.post('/bootstrap', { preHandler: requireJwtAuth }, async (request, reply) => {
    const { clerkId } = request.jwtAuth
    const { accountName, onboardingCompleted } = (request.body ?? {}) as {
      accountName?: string
      onboardingCompleted?: boolean
    }

    // Return existing account if already bootstrapped
    const existing = await prisma.accountUser.findFirst({
      where: { clerkId },
      include: { account: { select: accountSelect } },
    })

    if (existing) {
      // Update name and/or onboardingCompleted if provided
      const needsUpdate =
        (accountName && accountName !== existing.account.name) ||
        (onboardingCompleted === true && !existing.account.onboardingCompleted)

      const account = needsUpdate
        ? await prisma.account.update({
            where: { id: existing.accountId },
            data: {
              ...(accountName && accountName !== existing.account.name ? { name: accountName } : {}),
              ...(onboardingCompleted === true ? { onboardingCompleted: true } : {}),
            },
            select: accountSelect,
          })
        : existing.account

      return reply.send({ ...account, currentUser: { clerkId, role: existing.role } })
    }

    // Fetch user info from Clerk to seed email + name
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
    const clerkUser = await clerk.users.getUser(clerkId)
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? ''
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null

    const account = await prisma.account.create({
      data: {
        name: accountName ?? name ?? email.split('@')[0] ?? 'My Account',
        onboardingCompleted: false,
        users: { create: { clerkId, email, name, role: 'owner' } },
      },
      select: accountSelect,
    })

    return reply.status(201).send({ ...account, currentUser: { clerkId, role: 'owner' } })
  })

  // POST /accounts — create account + owner AccountUser record
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CreateAccountBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { name } = parsed.data
    const { clerkId, accountId } = request.auth

    const existingUser = await prisma.accountUser.findFirst({
      where: { clerkId, accountId },
      select: { email: true, name: true },
    })

    const account = await prisma.account.create({
      data: {
        name,
        users: {
          create: {
            clerkId,
            email: existingUser?.email ?? '',
            name: existingUser?.name ?? null,
            role: 'owner',
          },
        },
      },
      select: {
        id: true,
        name: true,
        plan: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return reply.status(201).send({
      ...account,
      currentUser: { clerkId, role: 'owner' },
    })
  })
}
