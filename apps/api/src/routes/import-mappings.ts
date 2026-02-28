import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { requireAuth, requireRole } from '../middleware/auth.js'

const ColumnMappingsSchema = z.object({
  name: z.string().optional(),
  price: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  vendor: z.string().optional(),
})

const CreateImportMappingBody = z.object({
  name: z.string().min(1).max(255),
  mappings: ColumnMappingsSchema,
})

const UpdateImportMappingBody = z.object({
  name: z.string().min(1).max(255).optional(),
  mappings: ColumnMappingsSchema.optional(),
})

export async function importMappingRoutes(app: FastifyInstance) {
  // GET /import-mappings — list all mapping profiles for the account
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const mappings = await prisma.importMapping.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(mappings)
  })

  // POST /import-mappings — create a new mapping profile (owner/admin only)
  app.post(
    '/',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const parsed = CreateImportMappingBody.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
      }

      const { accountId } = request.auth
      const { name, mappings } = parsed.data

      const mapping = await prisma.importMapping.create({
        data: {
          accountId,
          name,
          mappings,
        },
      })

      return reply.status(201).send(mapping)
    },
  )

  // GET /import-mappings/:id — get a single mapping profile
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const mapping = await prisma.importMapping.findFirst({
      where: { id, accountId },
    })

    if (!mapping) {
      return reply.status(404).send({ error: 'Import mapping not found' })
    }

    return reply.send(mapping)
  })

  // PATCH /import-mappings/:id — update name and/or mappings (owner/admin only)
  app.patch(
    '/:id',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const parsed = UpdateImportMappingBody.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
      }

      const { accountId } = request.auth
      const { id } = request.params as { id: string }
      const { name, mappings } = parsed.data

      const existing = await prisma.importMapping.findFirst({
        where: { id, accountId },
        select: { id: true },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Import mapping not found' })
      }

      const updated = await prisma.importMapping.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(mappings !== undefined ? { mappings } : {}),
        },
      })

      return reply.send(updated)
    },
  )

  // DELETE /import-mappings/:id — delete a mapping profile (owner/admin only)
  app.delete(
    '/:id',
    { preHandler: [requireAuth, requireRole('owner', 'admin')] },
    async (request, reply) => {
      const { accountId } = request.auth
      const { id } = request.params as { id: string }

      const existing = await prisma.importMapping.findFirst({
        where: { id, accountId },
        select: { id: true },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Import mapping not found' })
      }

      await prisma.importMapping.delete({ where: { id } })

      return reply.status(200).send({ ok: true })
    },
  )
}
