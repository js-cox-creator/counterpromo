import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { createClerkClient } from '@clerk/backend'
import { requireAuth, requireJwtAuth } from '../middleware/auth.js'

const CreateAccountBody = z.object({
  name: z.string().min(1).max(255),
})

// Basic account fields that always exist
const baseAccountSelect = {
  id: true,
  name: true,
  plan: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Try to read onboardingCompleted from an account row.
 * Returns false if the column doesn't exist yet (migration pending).
 */
async function getOnboardingCompleted(accountId: string): Promise<boolean> {
  try {
    const row = await prisma.account.findUnique({
      where: { id: accountId },
      select: { onboardingCompleted: true },
    })
    return row?.onboardingCompleted ?? false
  } catch {
    // Column not yet in DB (migration pending in deployed env)
    return false
  }
}

/**
 * Try to set onboardingCompleted = true on an account.
 * No-op if the column doesn't exist yet.
 */
async function markOnboardingComplete(accountId: string): Promise<void> {
  try {
    await prisma.account.update({
      where: { id: accountId },
      data: { onboardingCompleted: true },
    })
  } catch {
    // Column not yet in DB — silently skip
  }
}

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

    const onboardingCompleted = await getOnboardingCompleted(accountId)

    return reply.send({
      ...account,
      onboardingCompleted,
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
    const { accountName, onboardingCompleted: markComplete } = (request.body ?? {}) as {
      accountName?: string
      onboardingCompleted?: boolean
    }

    // Check if AccountUser already exists (basic select — always safe)
    const existing = await prisma.accountUser.findFirst({
      where: { clerkId },
      select: {
        accountId: true,
        role: true,
        account: { select: baseAccountSelect },
      },
    })

    if (existing) {
      // Update name if provided
      let account = existing.account
      if (accountName && accountName !== existing.account.name) {
        account = await prisma.account.update({
          where: { id: existing.accountId },
          data: { name: accountName },
          select: baseAccountSelect,
        })
      }

      // Mark onboarding complete if requested
      if (markComplete) {
        await markOnboardingComplete(existing.accountId)
      }

      const onboardingCompleted = markComplete
        ? true
        : await getOnboardingCompleted(existing.accountId)

      return reply.send({
        ...account,
        onboardingCompleted,
        currentUser: { clerkId, role: existing.role },
      })
    }

    // New user — fetch Clerk profile to seed name/email
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
    const clerkUser = await clerk.users.getUser(clerkId)
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? ''
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null

    // Create account — try with onboardingCompleted first, fall back if column missing
    const accountName_ = accountName ?? name ?? email.split('@')[0] ?? 'My Account'
    let account: Awaited<ReturnType<typeof prisma.account.create>>
    try {
      account = await prisma.account.create({
        data: {
          name: accountName_,
          onboardingCompleted: false,
          users: { create: { clerkId, email, name, role: 'owner' } },
        },
      })
    } catch {
      // onboardingCompleted column may not exist yet (migration pending)
      account = await prisma.account.create({
        data: {
          name: accountName_,
          users: { create: { clerkId, email, name, role: 'owner' } },
        },
      })
    }

    return reply.status(201).send({
      ...account,
      onboardingCompleted: false,
      currentUser: { clerkId, role: 'owner' },
    })
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
      select: baseAccountSelect,
    })

    return reply.status(201).send({
      ...account,
      onboardingCompleted: false,
      currentUser: { clerkId, role: 'owner' },
    })
  })
}
