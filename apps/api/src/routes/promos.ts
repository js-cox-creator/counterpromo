import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { BillingPlan, JobType, PLAN_LIMITS } from '@counterpromo/shared'
import { requireAuth } from '../middleware/auth.js'
import { getUploadPresignedUrl, getAssetSignedUrl } from '../lib/s3.js'
import { enqueueJob } from '../lib/sqs.js'

const CreatePromoBody = z.object({
  title: z.string().min(1).max(255),
  subhead: z.string().max(500).optional(),
  cta: z.string().max(255).optional(),
  templateId: z.string().optional(),
})

const BulkItemsBody = z.object({
  items: z.array(
    z.object({
      sku: z.string().optional(),
      name: z.string().min(1),
      price: z.number(),
      unit: z.string().optional(),
      category: z.string().optional(),
      vendor: z.string().optional(),
      imageUrl: z.string().url().optional(),
      sourceUrl: z.string().url().optional(),
    }),
  ),
})

const ItemFromUrlBody = z.object({
  url: z.string().url(),
  itemId: z.string().optional(),
})

const UploadBody = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
})

export async function promoRoutes(app: FastifyInstance) {
  // GET /promos — list promos for account (exclude archived), with item count
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const promos = await prisma.promo.findMany({
      where: {
        accountId,
        status: { not: 'archived' },
      },
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = promos.map(({ _count, ...promo }) => ({
      ...promo,
      itemCount: _count.items,
    }))

    return reply.send(result)
  })

  // POST /promos — create promo (check usage limit first)
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CreatePromoBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { title, subhead, cta, templateId } = parsed.data

    // Fetch account plan
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true },
    })
    if (!account) {
      return reply.status(404).send({ error: 'Account not found' })
    }

    const plan = account.plan as BillingPlan
    const limits = PLAN_LIMITS[plan]

    // Check current month usage
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1

    const usage = await prisma.usageMonthly.findUnique({
      where: { accountId_year_month: { accountId, year, month } },
      select: { promosCount: true },
    })

    const promosCount = usage?.promosCount ?? 0
    if (promosCount >= limits.promosPerMonth) {
      return reply.status(403).send({
        error: 'Usage limit reached',
        limit: limits.promosPerMonth,
      })
    }

    // Create promo + increment usage in a transaction
    const [promo] = await prisma.$transaction([
      prisma.promo.create({
        data: {
          accountId,
          title,
          subhead: subhead ?? null,
          cta: cta ?? null,
          templateId: templateId ?? null,
          status: 'draft',
        },
      }),
      prisma.usageMonthly.upsert({
        where: { accountId_year_month: { accountId, year, month } },
        create: { accountId, year, month, promosCount: 1 },
        update: { promosCount: { increment: 1 } },
      }),
    ])

    return reply.status(201).send(promo)
  })

  // PATCH /promos/:id — update promo fields (title, subhead, cta, templateId)
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const body = request.body as {
      title?: string
      subhead?: string | null
      cta?: string | null
      templateId?: string | null
    }

    const promo = await prisma.promo.findFirst({
      where: { id, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const updated = await prisma.promo.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.subhead !== undefined ? { subhead: body.subhead } : {}),
        ...(body.cta !== undefined ? { cta: body.cta } : {}),
        ...(body.templateId !== undefined ? { templateId: body.templateId } : {}),
      },
    })

    return reply.send(updated)
  })

  // GET /promos/:id — get promo with all items (verify ownership)
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const promo = await prisma.promo.findFirst({
      where: { id, accountId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    return reply.send(promo)
  })

  // POST /promos/:id/duplicate — duplicate promo + all items as a new draft
  app.post('/:id/duplicate', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const original = await prisma.promo.findFirst({
      where: { id, accountId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!original) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const duplicate = await prisma.promo.create({
      data: {
        accountId,
        title: `${original.title} (Copy)`,
        subhead: original.subhead,
        cta: original.cta,
        templateId: original.templateId,
        status: 'draft',
        items: {
          create: original.items.map((item) => ({
            sku: item.sku,
            name: item.name,
            price: item.price,
            unit: item.unit,
            category: item.category,
            vendor: item.vendor,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return reply.status(201).send(duplicate)
  })

  // POST /promos/:id/items — bulk replace all items
  app.post('/:id/items', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = BulkItemsBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { id } = request.params as { id: string }
    const { items } = parsed.data

    const promo = await prisma.promo.findFirst({
      where: { id, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    // Delete existing items then insert new ones
    await prisma.$transaction([
      prisma.promoItem.deleteMany({ where: { promoId: id } }),
      prisma.promoItem.createMany({
        data: items.map((item, index) => ({
          promoId: id,
          sku: item.sku ?? null,
          name: item.name,
          price: item.price,
          unit: item.unit ?? null,
          category: item.category ?? null,
          vendor: item.vendor ?? null,
          imageUrl: item.imageUrl ?? null,
          sourceUrl: item.sourceUrl ?? null,
          sortOrder: index,
        })),
      }),
    ])

    const updatedItems = await prisma.promoItem.findMany({
      where: { promoId: id },
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send(updatedItems)
  })

  // POST /promos/:id/items/from-url — enqueue ProductUrlScrape job
  app.post('/:id/items/from-url', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = ItemFromUrlBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { id: promoId } = request.params as { id: string }
    const { url, itemId: existingItemId } = parsed.data

    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    // If no itemId provided, create a placeholder PromoItem
    let itemId = existingItemId
    if (!itemId) {
      const placeholder = await prisma.promoItem.create({
        data: {
          promoId,
          name: 'Loading…',
          price: 0,
          sourceUrl: url,
        },
        select: { id: true },
      })
      itemId = placeholder.id
    }

    // Create a Job record
    const job = await prisma.job.create({
      data: {
        accountId,
        promoId,
        type: 'product_url_scrape',
        status: 'pending',
        payload: { url, itemId },
      },
    })

    // Enqueue to SQS
    await enqueueJob({
      type: JobType.ProductUrlScrape,
      jobId: job.id,
      accountId,
      promoId,
      itemId,
      url,
    })

    return reply.status(202).send({ jobId: job.id, itemId })
  })

  // POST /promos/:id/upload — return a presigned S3 PUT URL for CSV/XLSX upload
  app.post('/:id/upload', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = UploadBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { id: promoId } = request.params as { id: string }
    const { filename, contentType } = parsed.data

    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const timestamp = Date.now()
    const s3Key = `uploads/${accountId}/${promoId}/${timestamp}-${filename}`

    // Create Upload record
    const upload = await prisma.upload.create({
      data: {
        accountId,
        promoId,
        s3Key,
        filename,
        mimeType: contentType,
        sizeBytes: 0, // unknown until upload completes
      },
      select: { id: true },
    })

    // Get presigned URL
    const uploadUrl = await getUploadPresignedUrl(s3Key, contentType)

    return reply.send({
      uploadUrl,
      uploadId: upload.id,
      s3Key,
    })
  })

  // POST /promos/:id/parse-upload — trigger parsing of an already-uploaded file
  app.post('/:id/parse-upload', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id: promoId } = request.params as { id: string }

    const body = request.body as { uploadId?: string; s3Key?: string }
    if (!body.uploadId || !body.s3Key) {
      return reply.status(400).send({ error: 'uploadId and s3Key are required' })
    }

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
        type: 'parse_upload',
        status: 'pending',
        payload: { uploadId: body.uploadId, s3Key: body.s3Key },
      },
    })

    await enqueueJob({
      type: JobType.ParseUpload,
      jobId: job.id,
      accountId,
      promoId,
      uploadId: body.uploadId,
      s3Key: body.s3Key,
    })

    return reply.status(202).send({ jobId: job.id })
  })

  // POST /promos/:id/render — enqueue RenderPreview + RenderPdf jobs
  app.post('/:id/render', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id: promoId } = request.params as { id: string }

    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true },
    })

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' })
    }

    const plan = account.plan as BillingPlan
    const watermark = PLAN_LIMITS[plan].watermark

    // Create both Job records
    const [previewJob, pdfJob] = await prisma.$transaction([
      prisma.job.create({
        data: {
          accountId,
          promoId,
          type: 'render_preview',
          status: 'pending',
          payload: { promoId },
        },
      }),
      prisma.job.create({
        data: {
          accountId,
          promoId,
          type: 'render_pdf',
          status: 'pending',
          payload: { promoId, watermark },
        },
      }),
    ])

    // Enqueue both jobs to SQS
    await Promise.all([
      enqueueJob({
        type: JobType.RenderPreview,
        jobId: previewJob.id,
        accountId,
        promoId,
      }),
      enqueueJob({
        type: JobType.RenderPdf,
        jobId: pdfJob.id,
        accountId,
        promoId,
        watermark,
      }),
    ])

    return reply.status(202).send({
      jobs: [
        { jobId: previewJob.id, type: 'render_preview' },
        { jobId: pdfJob.id, type: 'render_pdf' },
      ],
    })
  })

  // DELETE /promos/:id/items/:itemId — delete a single item
  app.delete('/:id/items/:itemId', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id: promoId, itemId } = request.params as { id: string; itemId: string }

    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const item = await prisma.promoItem.findFirst({
      where: { id: itemId, promoId },
      select: { id: true },
    })

    if (!item) {
      return reply.status(404).send({ error: 'Item not found' })
    }

    await prisma.promoItem.delete({ where: { id: itemId } })

    return reply.status(200).send({ ok: true })
  })

  // GET /promos/:id/assets — list assets with signed S3 URLs
  app.get('/:id/assets', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id: promoId } = request.params as { id: string }

    const promo = await prisma.promo.findFirst({
      where: { id: promoId, accountId },
      select: { id: true },
    })

    if (!promo) {
      return reply.status(404).send({ error: 'Promo not found' })
    }

    const assets = await prisma.asset.findMany({
      where: { promoId, accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        s3Key: true,
        createdAt: true,
      },
    })

    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => ({
        id: asset.id,
        type: asset.type,
        url: await getAssetSignedUrl(asset.s3Key),
        createdAt: asset.createdAt,
      })),
    )

    return reply.send(assetsWithUrls)
  })
}
