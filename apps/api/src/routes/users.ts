import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { requireAuth, requireRole } from '../middleware/auth.js'

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'marketing', 'branch_manager']),
})

const PatchRoleBody = z.object({
  role: z.enum(['admin', 'member', 'marketing', 'branch_manager']),
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

  // GET /users/invites — list pending invites for the account
  app.get(
    '/invites',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const { accountId } = request.auth

      const invites = await prisma.invite.findMany({
        where: {
          accountId,
          status: 'pending',
          expiresAt: { gt: new Date() },
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
        orderBy: { createdAt: 'desc' },
      })

      return reply.send(invites)
    },
  )

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
          role: role as 'admin' | 'member' | 'marketing' | 'branch_manager',
          status: 'pending',
          expiresAt,
        },
        update: {
          role: role as 'admin' | 'member' | 'marketing' | 'branch_manager',
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

  // DELETE /users/invites/:id — revoke an invite
  app.delete(
    '/invites/:id',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const { accountId } = request.auth
      const { id } = request.params as { id: string }

      const invite = await prisma.invite.findFirst({
        where: { id, accountId },
        select: { id: true },
      })

      if (!invite) {
        return reply.status(404).send({ error: 'Invite not found' })
      }

      await prisma.invite.delete({ where: { id: invite.id } })

      return reply.status(204).send()
    },
  )

  // PATCH /users/:id — change a member's role
  app.patch(
    '/:id',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const { accountId, role: actorRole } = request.auth
      const { id } = request.params as { id: string }

      const parsed = PatchRoleBody.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
      }

      const { role: newRole } = parsed.data

      const targetUser = await prisma.accountUser.findFirst({
        where: { id, accountId },
        select: { id: true, role: true },
      })

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found' })
      }

      // Cannot change the owner's role
      if (targetUser.role === 'owner') {
        return reply.status(403).send({ error: "Cannot change the owner's role" })
      }

      // Admin can only change member/marketing/branch_manager roles (not other admins)
      if (actorRole === 'admin' && targetUser.role === 'admin') {
        return reply.status(403).send({ error: 'Admins cannot change the role of other admins' })
      }

      const updated = await prisma.accountUser.update({
        where: { id: targetUser.id },
        data: { role: newRole as 'admin' | 'member' | 'marketing' | 'branch_manager' },
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      })

      return reply.send(updated)
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
