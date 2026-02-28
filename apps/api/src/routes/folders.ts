import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { requireAuth } from '../middleware/auth.js'

const FolderBody = z.object({
  name: z.string().min(1).max(100),
})

export async function folderRoutes(app: FastifyInstance) {
  // GET /folders — list all folders for account with promo count
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const folders = await prisma.promoFolder.findMany({
      where: { accountId },
      include: { _count: { select: { promos: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send(
      folders.map(({ _count, ...f }) => ({ ...f, promoCount: _count.promos })),
    )
  })

  // POST /folders — create a folder
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = FolderBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const folder = await prisma.promoFolder.create({
      data: { accountId, name: parsed.data.name },
      include: { _count: { select: { promos: true } } },
    })

    const { _count, ...rest } = folder
    return reply.status(201).send({ ...rest, promoCount: _count.promos })
  })

  // PATCH /folders/:id — rename a folder
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = FolderBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const folder = await prisma.promoFolder.findFirst({
      where: { id, accountId },
      select: { id: true },
    })

    if (!folder) {
      return reply.status(404).send({ error: 'Folder not found' })
    }

    const updated = await prisma.promoFolder.update({
      where: { id },
      data: { name: parsed.data.name },
      include: { _count: { select: { promos: true } } },
    })

    const { _count, ...rest } = updated
    return reply.send({ ...rest, promoCount: _count.promos })
  })

  // DELETE /folders/:id — delete folder (promos become unfiled via SetNull)
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const folder = await prisma.promoFolder.findFirst({
      where: { id, accountId },
      select: { id: true },
    })

    if (!folder) {
      return reply.status(404).send({ error: 'Folder not found' })
    }

    await prisma.promoFolder.delete({ where: { id } })
    return reply.send({ ok: true })
  })
}
