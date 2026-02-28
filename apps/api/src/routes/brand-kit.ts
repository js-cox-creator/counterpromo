import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { JobType } from '@counterpromo/shared'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { enqueueJob } from '../lib/sqs.js'

const UpsertBrandKitBody = z.object({
  logoUrl: z.string().url().optional(),
  colors: z.array(z.string()).optional(),
  fonts: z.array(z.string()).optional(),
  defaultCta: z.string().max(255).optional(),
  websiteUrl: z.string().url().optional(),
})

const BootstrapFromUrlBody = z.object({
  url: z.string().url(),
})

export async function brandKitRoutes(app: FastifyInstance) {
  // GET /brand-kit — return brand kit for auth'd account (null if not yet created)
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const brandKit = await prisma.brandKit.findUnique({
      where: { accountId },
    })

    return reply.send(brandKit)
  })

  // POST /brand-kit — upsert brand kit (owner/admin only)
  app.post('/', { preHandler: [requireAuth, requireRole('owner', 'admin')] }, async (request, reply) => {
    const parsed = UpsertBrandKitBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { logoUrl, colors, fonts, defaultCta, websiteUrl } = parsed.data

    const brandKit = await prisma.brandKit.upsert({
      where: { accountId },
      create: {
        accountId,
        logoUrl: logoUrl ?? null,
        colors: colors ?? [],
        fonts: fonts ?? [],
        defaultCta: defaultCta ?? null,
        websiteUrl: websiteUrl ?? null,
      },
      update: {
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(colors !== undefined ? { colors } : {}),
        ...(fonts !== undefined ? { fonts } : {}),
        ...(defaultCta !== undefined ? { defaultCta } : {}),
        ...(websiteUrl !== undefined ? { websiteUrl } : {}),
      },
    })

    return reply.send(brandKit)
  })

  // POST /brand-kit/bootstrap-from-url — enqueue a BrandBootstrap job
  app.post('/bootstrap-from-url', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = BootstrapFromUrlBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { url } = parsed.data

    // Create a Job record
    const job = await prisma.job.create({
      data: {
        accountId,
        type: 'brand_bootstrap',
        status: 'pending',
        payload: { url },
      },
    })

    // Enqueue to SQS
    await enqueueJob({
      type: JobType.BrandBootstrap,
      jobId: job.id,
      accountId,
      url,
    })

    return reply.status(202).send({ jobId: job.id })
  })
}
