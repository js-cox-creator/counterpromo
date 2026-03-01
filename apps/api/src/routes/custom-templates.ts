import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@counterpromo/db'
import { requireAuth } from '../middleware/auth.js'

const CreateBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  htmlContent: z.string().min(1),
  isSystem: z.boolean().optional(),
})

const UpdateBody = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  htmlContent: z.string().min(1).optional(),
})

export async function customTemplateRoutes(app: FastifyInstance) {
  // GET /custom-templates — list account + system templates
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const templates = await prisma.customTemplate.findMany({
      where: {
        OR: [{ accountId }, { isSystem: true }],
      },
      orderBy: [{ isSystem: 'asc' }, { name: 'asc' }],
    })

    return reply.send(templates)
  })

  // POST /custom-templates — create template
  app.post('/', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CreateBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId, isProductAdmin } = request.auth
    const { name, description, htmlContent, isSystem } = parsed.data

    // Only product admins can create system templates
    if (isSystem && !isProductAdmin) {
      return reply.status(403).send({ error: 'Only product admins can create system templates' })
    }

    const template = await prisma.customTemplate.create({
      data: {
        accountId: isSystem ? null : accountId,
        name,
        description: description ?? null,
        htmlContent,
        isSystem: isSystem ?? false,
      },
    })

    return reply.status(201).send(template)
  })

  // GET /custom-templates/:id — single template
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const template = await prisma.customTemplate.findFirst({
      where: {
        id,
        OR: [{ accountId }, { isSystem: true }],
      },
    })

    if (!template) {
      return reply.status(404).send({ error: 'Template not found' })
    }

    return reply.send(template)
  })

  // PATCH /custom-templates/:id — update own templates; product admins can also update system templates
  app.patch('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = UpdateBody.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0]?.message ?? 'Invalid body' })
    }

    const { accountId, isProductAdmin } = request.auth
    const { id } = request.params as { id: string }

    const existing = await prisma.customTemplate.findFirst({
      where: {
        id,
        OR: [
          { accountId },
          ...(isProductAdmin ? [{ isSystem: true }] : []),
        ],
      },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' })
    }

    const { name, description, htmlContent } = parsed.data

    const updated = await prisma.customTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(htmlContent !== undefined ? { htmlContent } : {}),
      },
    })

    return reply.send(updated)
  })

  // DELETE /custom-templates/:id — delete own templates; product admins can also delete system templates
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId, isProductAdmin } = request.auth
    const { id } = request.params as { id: string }

    const existing = await prisma.customTemplate.findFirst({
      where: {
        id,
        OR: [
          { accountId },
          ...(isProductAdmin ? [{ isSystem: true }] : []),
        ],
      },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Template not found' })
    }

    await prisma.customTemplate.delete({ where: { id } })

    return reply.status(200).send({ ok: true })
  })
}
