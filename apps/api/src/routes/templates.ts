import type { FastifyInstance } from 'fastify'
import { TEMPLATE_METADATA } from '@counterpromo/shared'

export async function templateRoutes(app: FastifyInstance) {
  // GET /templates — list all available templates with metadata (no auth required)
  app.get('/', async (_request, reply) => {
    return reply.send(TEMPLATE_METADATA)
  })
}
