import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { requireAuth, requireRole } from '../middleware/auth.js'

const CreateBranchBody = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email').optional(),
  cta: z.string().max(255).optional(),
})

const UpdateBranchBody = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable(),
  cta: z.string().max(255).optional().nullable(),
})

export async function branchRoutes(app: FastifyInstance) {
  // GET /branches — list all branches for the auth'd account
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const branches = await prisma.branch.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send(branches)
  })

  // POST /branches — create a branch (owner/admin only)
  app.post('/', { preHandler: [requireAuth, requireRole('owner', 'admin')] }, async (request, reply) => {
    const parsed = CreateBranchBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { name, address, phone, email, cta } = parsed.data

    const branch = await prisma.branch.create({
      data: {
        accountId,
        name,
        address: address ?? null,
        phone: phone ?? null,
        email: email ?? null,
        cta: cta ?? null,
      },
    })

    return reply.status(201).send(branch)
  })

  // GET /branches/:id — get single branch (verify ownership)
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const branch = await prisma.branch.findFirst({
      where: { id, accountId },
    })

    if (!branch) {
      return reply.status(404).send({ error: 'Branch not found' })
    }

    return reply.send(branch)
  })

  // PATCH /branches/:id — update branch fields (owner/admin only)
  app.patch('/:id', { preHandler: [requireAuth, requireRole('owner', 'admin')] }, async (request, reply) => {
    const parsed = UpdateBranchBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const existing = await prisma.branch.findFirst({
      where: { id, accountId },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Branch not found' })
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: parsed.data,
    })

    return reply.send(branch)
  })

  // DELETE /branches/:id — delete branch (owner/admin only; cannot delete if it has promos)
  app.delete('/:id', { preHandler: [requireAuth, requireRole('owner', 'admin')] }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const existing = await prisma.branch.findFirst({
      where: { id, accountId },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Branch not found' })
    }

    const promoCount = await prisma.promo.count({
      where: { branchId: id },
    })

    if (promoCount > 0) {
      return reply.status(400).send({
        error: `Cannot delete this branch — it has ${promoCount} promo${promoCount === 1 ? '' : 's'} associated with it. Reassign or delete those promos first.`,
      })
    }

    await prisma.branch.delete({ where: { id } })

    return reply.send({ ok: true })
  })
}
