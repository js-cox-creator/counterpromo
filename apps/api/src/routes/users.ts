import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { requireAuth, requireRole } from '../middleware/auth.js'

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
})

export async function userRoutes(app: FastifyInstance) {
  // GET /users — list all AccountUsers for the account
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const users = await prisma.accountUser.findMany({
      where: { accountId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send(users)
  })

  // POST /users/invite — create Invite record
  app.post(
    '/invite',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const parsed = InviteBody.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
      }

      const { accountId } = request.auth
      const { email, role } = parsed.data

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +7 days

      // Upsert — if a pending invite already exists for this email+account, renew it
      const invite = await prisma.invite.upsert({
        where: { accountId_email: { accountId, email } },
        create: {
          accountId,
          email,
          role: role as 'admin' | 'member',
          status: 'pending',
          expiresAt,
        },
        update: {
          role: role as 'admin' | 'member',
          status: 'pending',
          expiresAt,
        },
        select: {
          id: true,
          email: true,
          role: true,
          token: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
      })

      return reply.status(201).send(invite)
    },
  )

  // DELETE /users/:id — remove AccountUser
  app.delete(
    '/:id',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const { accountId, clerkId } = request.auth
      const { id } = request.params as { id: string }

      const targetUser = await prisma.accountUser.findFirst({
        where: { id, accountId },
        select: { id: true, clerkId: true, role: true },
      })

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' })
      }

      // Cannot remove yourself
      if (targetUser.clerkId === clerkId) {
        return reply.status(400).send({ error: 'Cannot remove yourself from the account' })
      }

      await prisma.accountUser.delete({ where: { id: targetUser.id } })

      return reply.status(204).send()
    },
  )
}
