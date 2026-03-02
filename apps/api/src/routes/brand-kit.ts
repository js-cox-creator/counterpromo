import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { JobType } from '@counterpromo/shared'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { enqueueJob } from '../lib/sqs.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const UpsertBrandKitBody = z.object({
  logoUrl: z.string().url().optional(),
  colors: z.array(z.string()).optional(),
  textColors: z.array(z.string()).optional(),
  fonts: z.array(z.string()).optional(),
  defaultCta: z.string().max(255).optional(),
  websiteUrl: z.string().url().optional(),
  strapline: z.string().max(500).optional(),
  aiDescription: z.string().max(2000).optional(),
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
    const { logoUrl, colors, textColors, fonts, defaultCta, websiteUrl, strapline, aiDescription } = parsed.data

    const brandKit = await prisma.brandKit.upsert({
      where: { accountId },
      create: {
        accountId,
        logoUrl: logoUrl ?? null,
        colors: colors ?? [],
        textColors: textColors ?? [],
        fonts: fonts ?? [],
        defaultCta: defaultCta ?? null,
        websiteUrl: websiteUrl ?? null,
        strapline: strapline ?? null,
        aiDescription: aiDescription ?? null,
      },
      update: {
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(colors !== undefined ? { colors } : {}),
        ...(textColors !== undefined ? { textColors } : {}),
        ...(fonts !== undefined ? { fonts } : {}),
        ...(defaultCta !== undefined ? { defaultCta } : {}),
        ...(websiteUrl !== undefined ? { websiteUrl } : {}),
        ...(strapline !== undefined ? { strapline } : {}),
        ...(aiDescription !== undefined ? { aiDescription } : {}),
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

    // Enqueue to SQS (non-fatal — see lib/sqs.ts)
    await enqueueJob({
      type: JobType.BrandBootstrap,
      jobId: job.id,
      accountId,
      url,
    })

    return reply.status(202).send({ jobId: job.id })
  })

  // POST /brand-kit/generate-description — generate AI business description via Gemini
  app.post('/generate-description', { preHandler: [requireAuth, requireRole('owner', 'admin')] }, async (request, reply) => {
    const { accountId } = request.auth

    const brandKit = await prisma.brandKit.findUnique({ where: { accountId } })
    if (!brandKit) return reply.status(404).send({ error: 'Brand kit not found' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return reply.status(503).send({ error: 'AI description generation is not configured' })

    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { name: true } })
    const colors = (brandKit.colors as string[]) ?? []
    const fonts = (brandKit.fonts as string[]) ?? []

    const context = [
      `Company name: ${account?.name ?? 'this company'}`,
      brandKit.strapline ? `Strapline: "${brandKit.strapline}"` : null,
      brandKit.websiteUrl ? `Website: ${brandKit.websiteUrl}` : null,
      colors.length > 0 ? `Brand colors: ${colors.join(', ')}` : null,
      fonts.length > 0 ? `Brand fonts: ${fonts.join(', ')}` : null,
    ].filter(Boolean).join('\n')

    const prompt = `You are writing marketing copy for a building materials or hardware dealer's brand guidelines page.

${context}

Write a single short paragraph (2-3 sentences, max 60 words) that describes what this company offers and why customers should choose them. Write in an engaging, confident, promotional voice. Do not start with the company name. Do not use quotation marks. Output plain text only.`

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
      const result = await model.generateContent(prompt)
      const aiDescription = result.response.text().trim()

      // Save to brand kit
      await prisma.brandKit.update({ where: { accountId }, data: { aiDescription } })

      return reply.send({ aiDescription })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      return reply.status(500).send({ error: msg })
    }
  })
}
