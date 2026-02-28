import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { requireAuth } from '../middleware/auth.js'

const CreateSnippetBody = z.object({
  name: z.string().min(1).max(255),
  price: z.number().nonnegative(),
  sku: z.string().max(100).optional(),
  unit: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  vendor: z.string().max(255).optional(),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
})

const UpdateSnippetBody = z.object({
  name: z.string().min(1).max(255).optional(),
  price: z.number().nonnegative().optional(),
  sku: z.string().max(100).optional(),
  unit: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  vendor: z.string().max(255).optional(),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
})

export async function snippetRoutes(app: FastifyInstance) {
  // GET /snippets — list snippets for account, ordered by name
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const snippets = await prisma.productSnippet.findMany({
      where: { accountId },
      orderBy: { name: 'asc' },
    })

    return reply.send(snippets)
  })

  // POST /snippets — create a new snippet
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CreateSnippetBody.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { name, price, sku, unit, category, vendor, imageUrl, sourceUrl } = parsed.data

    const snippet = await prisma.productSnippet.create({
      data: {
        accountId,
        name,
        price,
        sku: sku ?? null,
        unit: unit ?? null,
        category: category ?? null,
        vendor: vendor ?? null,
        imageUrl: imageUrl ?? null,
        sourceUrl: sourceUrl ?? null,
      },
    })

    return reply.status(201).send(snippet)
  })

  // PATCH /snippets/:id — update a snippet (verify ownership first)
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = UpdateSnippetBody.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const existing = await prisma.productSnippet.findFirst({
      where: { id, accountId },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Snippet not found' })
    }

    const { name, price, sku, unit, category, vendor, imageUrl, sourceUrl } = parsed.data

    const updated = await prisma.productSnippet.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(sku !== undefined ? { sku } : {}),
        ...(unit !== undefined ? { unit } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(vendor !== undefined ? { vendor } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(sourceUrl !== undefined ? { sourceUrl } : {}),
      },
    })

    return reply.send(updated)
  })

  // DELETE /snippets/:id — delete a snippet (verify ownership first)
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const existing = await prisma.productSnippet.findFirst({
      where: { id, accountId },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Snippet not found' })
    }

    await prisma.productSnippet.delete({ where: { id } })

    return reply.status(200).send({ ok: true })
  })
}
