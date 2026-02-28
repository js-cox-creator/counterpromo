import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { JobType } from '@counterpromo/shared'
import { requireAuth } from '../middleware/auth.js'
import { enqueueJob } from '../lib/sqs.js'
import { getAssetSignedUrl } from '../lib/s3.js'

const UpdateCoopItemsBody = z.object({
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      coopVendor: z.string().max(255).optional(),
      coopAmount: z.number().nonnegative().optional(),
      coopNote: z.string().max(1000).optional(),
    }),
  ),
})

export async function coopRoutes(app: FastifyInstance) {
  // GET /coop/promos/:promoId/items — return all promo items with co-op fields
  app.get('/promos/:promoId/items', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { promoId } = request.params as { promoId: string }

    // Verify promo ownership
    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const items = await prisma.promoItem.findMany({
      where: { promoId },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        coopVendor: true,
        coopAmount: true,
        coopNote: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send(items)
  })

  // POST /coop/promos/:promoId/items — update co-op fields on promo items
  app.post('/promos/:promoId/items', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { promoId } = request.params as { promoId: string }

    const parsed = UpdateCoopItemsBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    // Verify promo ownership
    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const { items } = parsed.data

    await Promise.all(
      items.map((item) =>
        prisma.promoItem.update({
          where: { id: item.itemId },
          data: {
            ...(item.coopVendor !== undefined ? { coopVendor: item.coopVendor } : {}),
            ...(item.coopAmount !== undefined ? { coopAmount: item.coopAmount } : {}),
            ...(item.coopNote !== undefined ? { coopNote: item.coopNote } : {}),
          },
        }),
      ),
    )

    return reply.send({ ok: true, updated: items.length })
  })

  // POST /coop/promos/:promoId/report — enqueue a generate_coop_report job
  app.post('/promos/:promoId/report', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { promoId } = request.params as { promoId: string }

    // Verify promo ownership
    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const job = await prisma.job.create({
      data: {
        accountId,
        promoId,
        type: 'generate_coop_report',
        status: 'pending',
        payload: { promoId },
      },
    })

    await enqueueJob({
      type: JobType.GenerateCoopReport,
      jobId: job.id,
      accountId,
      promoId,
    })

    return reply.status(202).send({ jobId: job.id })
  })

  // GET /coop/promos/:promoId/report-asset — return signed URL for most recent co-op report
  app.get('/promos/:promoId/report-asset', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { promoId } = request.params as { promoId: string }

    // Verify promo ownership
    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const asset = await prisma.asset.findFirst({
      where: { promoId, type: 'coop_report' },
      orderBy: { createdAt: 'desc' },
    })

    if (!asset) {
      return reply.send({ url: null })
    }

    const url = await getAssetSignedUrl(asset.s3Key)

    return reply.send({ url, createdAt: asset.createdAt })
  })
}
